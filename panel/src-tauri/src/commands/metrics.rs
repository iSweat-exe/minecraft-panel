use crate::error::AppError;
use crate::state::SshState;

use tauri::Emitter;
use tauri::State;

use crate::models::SystemMetrics;

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
    if let Some(tx) = task_guard.take() {
        let _ = tx.send(());
    }
    drop(task_guard);

    let mut session_guard = state.session.lock().await;
    let session = session_guard
        .as_mut()
        .ok_or_else(|| AppError::Message("Not connected".into()))?;

    let mut channel = session.channel_open_session().await?;

    let script = r#"bash -c '
export LC_ALL=C

prev_idle=0
prev_total=0
prev_rx=0
prev_tx=0

while true; do
    sleep 1

    read -r _ u n s i io irq soft steal _ < /proc/stat
    idle=$(( i + io ))
    total=$(( u + n + s + i + io + irq + soft + steal ))
    
    diff_idle=$(( idle - prev_idle ))
    diff_total=$(( total - prev_total ))
    
    cpu_pct="0.0"
    if [ "$diff_total" -gt 0 ] && [ "$prev_total" -gt 0 ]; then
        cpu_pct=$(awk "BEGIN {printf \"%.1f\", (1 - $diff_idle / $diff_total) * 100}")
    fi
    prev_idle=$idle
    prev_total=$total

    m_tot=$(grep MemTotal /proc/meminfo | awk "{print \$2}")
    m_avail=$(grep MemAvailable /proc/meminfo | awk "{print \$2}")
    ram_total=$(( m_tot / 1024 ))
    ram_used=$(( (m_tot - m_avail) / 1024 ))

    disk_line=$(df -BG / | tail -1)
    disk_total=$(echo "$disk_line" | awk "{print \$2}" | tr -dc "0-9")
    disk_used=$(echo "$disk_line" | awk "{print \$3}" | tr -dc "0-9")

    read -r rx tx <<< $(awk "NR>2{r+=\$2; t+=\$10} END{print r, t}" /proc/net/dev 2>/dev/null)
    rx_bps=0
    tx_bps=0
    if [ "$prev_rx" -gt 0 ]; then
        rx_bps=$(( rx - prev_rx ))
        tx_bps=$(( tx - prev_tx ))
    fi
    prev_rx=$rx
    prev_tx=$tx

    echo "${cpu_pct:-0.0} ${ram_used:-0} ${ram_total:-4096} ${disk_used:-0} ${disk_total:-0} ${rx_bps:-0} ${tx_bps:-0}"
done
'"#;


    channel.exec(true, script).await?;
    drop(session_guard);

    let (tx, mut rx) = tokio::sync::oneshot::channel::<()>();

    tauri::async_runtime::spawn(async move {
        loop {
            tokio::select! {
                _ = &mut rx => {
                    let _ = channel.eof().await;
                    let _ = channel.close().await;
                    break;
                }
                msg_opt = channel.wait() => {
                    match msg_opt {
                        Some(russh::ChannelMsg::Data { data }) => {
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
                        Some(_) => {} // Ignore other messages
                        None => break, // Channel closed from the other side
                    }
                }
            }
        }
    });

    *state.metrics_task.lock().await = Some(tx);
    Ok(())
}

#[tauri::command]
pub async fn metrics_unsubscribe(state: State<'_, SshState>) -> Result<(), AppError> {
    let mut task_guard = state.metrics_task.lock().await;
    if let Some(tx) = task_guard.take() {
        let _ = tx.send(());
    }
    Ok(())
}
