use crate::error::AppError;
use crate::state::SshState;
use serde::Serialize;
use tauri::Emitter;
use tauri::State;

#[derive(Serialize, Clone)]
pub struct SystemMetrics {
    /// CPU usage percentage (0-100)
    pub cpu_percent: f64,
    /// RAM used in MB
    pub ram_used_mb: u64,
    /// RAM total in MB
    pub ram_total_mb: u64,
    /// Disk used in GB
    pub disk_used_gb: f64,
    /// Disk total in GB
    pub disk_total_gb: f64,
    /// Network RX bytes per second
    pub network_rx_bps: u64,
    /// Network TX bytes per second
    pub network_tx_bps: u64,
}

/// Opens a persistent SSH channel that runs a bash loop emitting metrics
/// every 500ms. Each line is parsed and emitted as a `metrics-update` event.
/// This avoids the overhead of opening/closing SSH channels on every poll.
#[tauri::command]
pub async fn metrics_subscribe(
    app: tauri::AppHandle,
    state: State<'_, SshState>,
) -> Result<(), AppError> {
    let mut task_guard = state.metrics_task.lock().await;

    // Abort any previous subscription
    if let Some(handle) = task_guard.take() {
        handle.abort();
    }

    let mut session_guard = state.session.lock().await;
    let session = session_guard
        .as_mut()
        .ok_or_else(|| AppError::Message("Not connected".into()))?;

    let mut channel = session.channel_open_session().await?;

    // A single long-running script that outputs one line of metrics per iteration.
    // CPU is measured over a 0.5s delta, network over the same window.
    // Format: cpu_pct ram_used_mb ram_total_mb disk_used_gb disk_total_gb rx_bps tx_bps
    let script = r#"bash -c '
export LC_ALL=C

# Pre-read disk once (slow, rarely changes)
read disk_used disk_total <<< $(df -BG / 2>/dev/null | tail -1 | awk "{gsub(\"G\",\"\"); print \$3, \$2}")
disk_used=${disk_used:-0}
disk_total=${disk_total:-0}
disk_counter=0

# Initial CPU + network snapshot
read cpu_user cpu_nice cpu_sys cpu_idle cpu_rest <<< $(head -1 /proc/stat | awk "{print \$2, \$3, \$4, \$5, \$6+\$7+\$8+\$9+\$10}")
read rx tx <<< $(awk "NR>2{rx+=\$2; tx+=\$10} END{print rx, tx}" /proc/net/dev)

while true; do
    sleep 0.5

    read cpu2_user cpu2_nice cpu2_sys cpu2_idle cpu2_rest <<< $(head -1 /proc/stat | awk "{print \$2, \$3, \$4, \$5, \$6+\$7+\$8+\$9+\$10}")
    read rx2 tx2 <<< $(awk "NR>2{rx+=\$2; tx+=\$10} END{print rx, tx}" /proc/net/dev)

    idle1=$((cpu_idle))
    idle2=$((cpu2_idle))
    total1=$((cpu_user + cpu_nice + cpu_sys + cpu_idle + cpu_rest))
    total2=$((cpu2_user + cpu2_nice + cpu2_sys + cpu2_idle + cpu2_rest))
    diff_idle=$((idle2 - idle1))
    diff_total=$((total2 - total1))
    if [ $diff_total -gt 0 ]; then
        cpu_pct=$(awk "BEGIN{printf \"%.1f\", 100.0 * (1.0 - $diff_idle / $diff_total)}")
    else
        cpu_pct="0.0"
    fi

    rx_bps=$(( (rx2 - rx) * 2 ))
    tx_bps=$(( (tx2 - tx) * 2 ))

    read mem_total mem_avail <<< $(awk "/MemTotal/{t=\$2} /MemAvailable/{a=\$2} /MemFree/{f=\$2} /Buffers/{b=\$2} /^Cached/{c=\$2} END{if(a!=\"\") print t, a; else print t, f+b+c}" /proc/meminfo)
    mem_total=${mem_total:-1}
    mem_avail=${mem_avail:-0}
    ram_used_mb=$(( (mem_total - mem_avail) / 1024 ))
    ram_total_mb=$(( mem_total / 1024 ))

    # Re-read disk every 60 iterations (~30s)
    disk_counter=$((disk_counter + 1))
    if [ $disk_counter -ge 60 ]; then
        read disk_used disk_total <<< $(df -BG / 2>/dev/null | tail -1 | awk "{gsub(\"G\",\"\"); print \$3, \$2}")
        disk_used=${disk_used:-0}
        disk_total=${disk_total:-0}
        disk_counter=0
    fi

    echo "${cpu_pct} ${ram_used_mb} ${ram_total_mb} ${disk_used} ${disk_total} ${rx_bps} ${tx_bps}"

    # Shift for next iteration
    cpu_user=$cpu2_user; cpu_nice=$cpu2_nice; cpu_sys=$cpu2_sys; cpu_idle=$cpu2_idle; cpu_rest=$cpu2_rest
    rx=$rx2; tx=$tx2
done
'"#;

    channel.exec(true, script).await?;
    drop(session_guard);

    let handle = tauri::async_runtime::spawn(async move {
        while let Some(msg) = channel.wait().await {
            if let russh::ChannelMsg::Data { data } = msg {
                let text = String::from_utf8_lossy(&data);
                for line in text.lines() {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    let parts: Vec<&str> = trimmed.split_whitespace().collect();
                    if parts.len() >= 7 {
                        let metrics = SystemMetrics {
                            cpu_percent: parts[0].parse().unwrap_or(0.0),
                            ram_used_mb: parts[1].parse().unwrap_or(0),
                            ram_total_mb: parts[2].parse().unwrap_or(0),
                            disk_used_gb: parts[3].parse().unwrap_or(0.0),
                            disk_total_gb: parts[4].parse().unwrap_or(0.0),
                            network_rx_bps: parts[5].parse().unwrap_or(0),
                            network_tx_bps: parts[6].parse().unwrap_or(0),
                        };
                        let _ = app.emit("metrics-update", metrics);
                    }
                }
            }
        }
    });

    *task_guard = Some(handle);
    Ok(())
}
