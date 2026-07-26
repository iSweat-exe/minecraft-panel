use anyhow::Result;
use protocol::SystemMetricsResponse;
use std::sync::{LazyLock, Mutex};
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, Networks, RefreshKind, System};

static SYSINFO: LazyLock<Mutex<System>> = LazyLock::new(|| {
    Mutex::new(System::new_with_specifics(
        RefreshKind::nothing()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    ))
});

static NETWORKS: LazyLock<Mutex<Networks>> =
    LazyLock::new(|| Mutex::new(Networks::new_with_refreshed_list()));

static PREV_NET: LazyLock<Mutex<(u64, u64)>> = LazyLock::new(|| Mutex::new((0, 0)));

pub async fn get_metrics() -> Result<SystemMetricsResponse> {
    tokio::task::spawn_blocking(|| {
        let mut sys = SYSINFO.lock().unwrap_or_else(|e| e.into_inner());
        let mut nets = NETWORKS.lock().unwrap_or_else(|e| e.into_inner());
        let mut prev_net = PREV_NET.lock().unwrap_or_else(|e| e.into_inner());

        sys.refresh_cpu_usage();
        sys.refresh_memory();
        nets.refresh(true);

        let disks = Disks::new_with_refreshed_list();

        let cpu_usage = sys.global_cpu_usage();
        let ram_used = sys.used_memory() / 1024 / 1024;
        let ram_total = sys.total_memory() / 1024 / 1024;

        let mut disk_used = 0;
        let mut disk_total = 0;

        // We get the root disk "/" or simply sum all local disks
        for disk in &disks {
            if disk.mount_point().to_string_lossy() == "/" {
                disk_total = disk.total_space();
                disk_used = disk_total.saturating_sub(disk.available_space());
                break;
            }
        }

        if disk_total == 0 {
            // Fallback: sum all disks
            for disk in &disks {
                disk_total += disk.total_space();
                disk_used += disk.total_space().saturating_sub(disk.available_space());
            }
        }

        let mut total_rx = 0;
        let mut total_tx = 0;
        for data in nets.values() {
            total_rx += data.total_received();
            total_tx += data.total_transmitted();
        }

        let rx_bps = total_rx.saturating_sub(prev_net.0);
        let tx_bps = total_tx.saturating_sub(prev_net.1);
        *prev_net = (total_rx, total_tx);
        Ok(SystemMetricsResponse {
            cpu_percent: cpu_usage as f64,
            ram_used_mb: ram_used,
            ram_total_mb: ram_total,
            disk_used_gb: disk_used as f64 / 1024.0 / 1024.0 / 1024.0,
            disk_total_gb: disk_total as f64 / 1024.0 / 1024.0 / 1024.0,
            network_rx_bytes: rx_bps,
            network_tx_bytes: tx_bps,
        })
    })
    .await
    .unwrap_or_else(|e| Err(anyhow::anyhow!("Spawn blocking failed: {}", e)))
}

fn get_directory_size(path: &std::path::Path) -> u64 {
    let mut size = 0;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    size += get_directory_size(&entry.path());
                } else {
                    size += metadata.len();
                }
            }
        }
    }
    size
}

pub async fn start_metrics_collector(
    db: sqlx::SqlitePool,
    docker: crate::services::docker::DockerManager,
) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
    loop {
        interval.tick().await;

        let now = chrono::Utc::now().timestamp();
        tracing::debug!("Running metrics collector for all containers");

        match docker.list_managed_containers().await {
            Ok(containers) => {
                for c in containers {
                    if c.state != "running".into() {
                        continue;
                    }

                    let (cpu, mem_used, mem_limit, net_rx, net_tx) = match docker
                        .get_container_metrics(&c.container_id.clone().unwrap_or_default())
                        .await
                    {
                        Ok(stats) => stats,
                        Err(e) => {
                            tracing::warn!(
                                server_id = %c.server_id,
                                "Failed to get container metrics, skipping: {}",
                                e
                            );
                            continue;
                        }
                    };

                    // Compute disk size
                    let server_dir = std::path::Path::new("data/servers").join(&c.server_id);
                    let disk_used = get_directory_size(&server_dir);

                    let res = sqlx::query(
                        r#"
                        INSERT INTO server_metrics 
                        (server_id, timestamp, cpu_percent, memory_used_bytes, memory_limit_bytes, disk_used_bytes, network_rx_bytes, network_tx_bytes)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        "#,
                    )
                    .bind(&c.server_id)
                    .bind(now)
                    .bind(cpu)
                    .bind(mem_used as i64)
                    .bind(mem_limit as i64)
                    .bind(disk_used as i64)
                    .bind(net_rx as i64)
                    .bind(net_tx as i64)
                    .execute(&db)
                    .await;

                    if let Err(e) = res {
                        tracing::error!(
                            server_id = %c.server_id,
                            "Failed to insert metrics history: {}",
                            e
                        );
                    } else {
                        tracing::debug!(
                            server_id = %c.server_id,
                            cpu = %cpu,
                            mem_mb = %(mem_used / 1_048_576),
                            "Metrics recorded"
                        );
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to list containers for metrics collection: {}", e);
            }
        }

        // Cleanup old metrics (> 7 days)
        let seven_days_ago = now - (7 * 24 * 60 * 60);
        if let Err(e) = sqlx::query("DELETE FROM server_metrics WHERE timestamp < ?")
            .bind(seven_days_ago)
            .execute(&db)
            .await
        {
            tracing::error!("Failed to cleanup old metrics: {}", e);
        }
    }
}
