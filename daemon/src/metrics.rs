use anyhow::Result;
use protocol::SystemMetricsResponse;
use std::sync::Mutex;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, Networks, RefreshKind, System};

lazy_static::lazy_static! {
    static ref SYSINFO: Mutex<System> = Mutex::new(System::new_with_specifics(
        RefreshKind::nothing()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything())
    ));
    
    static ref NETWORKS: Mutex<Networks> = Mutex::new(Networks::new_with_refreshed_list());
    static ref PREV_NET: Mutex<(u64, u64)> = Mutex::new((0, 0));
}

pub fn get_metrics() -> Result<SystemMetricsResponse> {
    let mut sys = SYSINFO.lock().unwrap();
    let mut nets = NETWORKS.lock().unwrap();
    let mut prev_net = PREV_NET.lock().unwrap();

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
    for (_name, data) in nets.iter() {
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
        network_rx_bps: rx_bps,
        network_tx_bps: tx_bps,
    })
}
