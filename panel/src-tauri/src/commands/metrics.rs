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

prev_rx=""
prev_tx=""

while true; do
    sleep 0.5

    dstats=$(docker stats minecraft-panel-server --no-stream --format "{{.CPUPerc}} {{.MemUsage}}" 2>/dev/null)
    
    cpu_pct="0.0"
    ram_used=0
    ram_total=4096

    if [ -n "$dstats" ]; then
        cpu_raw=$(echo "$dstats" | awk "{print \$1}" | tr -d "%")
        mem_used_raw=$(echo "$dstats" | awk "{print \$2}")
        mem_tot_raw=$(echo "$dstats" | awk "{print \$4}")

        if [ -n "$cpu_raw" ]; then cpu_pct=$cpu_raw; fi

        val=$(echo "$mem_used_raw" | sed -E "s/([0-9.]+).*/\1/")
        if [[ "$mem_used_raw" == *"GiB"* ]]; then
            ram_used=$(awk "BEGIN{print int($val * 1024)}" 2>/dev/null || echo "0")
        else
            ram_used=$(awk "BEGIN{print int($val)}" 2>/dev/null || echo "0")
        fi

        val_t=$(echo "$mem_tot_raw" | sed -E "s/([0-9.]+).*/\1/")
        if [[ "$mem_tot_raw" == *"GiB"* ]]; then
            ram_total=$(awk "BEGIN{print int($val_t * 1024)}" 2>/dev/null || echo "4096")
        else
            ram_total=$(awk "BEGIN{print int($val_t)}" 2>/dev/null || echo "4096")
        fi
    else
        if [ -f /proc/meminfo ]; then
            m_tot=$(grep MemTotal /proc/meminfo | tr -dc "0-9")
            m_avail=$(grep MemAvailable /proc/meminfo | tr -dc "0-9")
            if [ -n "$m_tot" ] && [ -n "$m_avail" ]; then
                ram_total=$(( m_tot / 1024 ))
                ram_used=$(( (m_tot - m_avail) / 1024 ))
            fi
        fi
        cpu_pct=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk "{print 100 - \$1}" 2>/dev/null || echo "0.0")
    fi

    disk_line=$( (df -BG /minecraft 2>/dev/null || df -BG / 2>/dev/null) | tail -1)
    disk_used=$(echo "$disk_line" | awk "{print \$3}" | tr -dc "0-9")
    disk_total=$(echo "$disk_line" | awk "{print \$2}" | tr -dc "0-9")

    read rx tx <<< $(awk "NR>2{r+=\$2; t+=\$10} END{print r, t}" /proc/net/dev 2>/dev/null)
    rx_bps=0
    tx_bps=0
    if [ -n "$prev_rx" ]; then
        rx_bps=$(( (rx - prev_rx) * 2 ))
        tx_bps=$(( (tx - prev_tx) * 2 ))
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
