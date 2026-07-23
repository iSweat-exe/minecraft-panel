use crate::error::AppError;
use crate::state::SshState;
use crate::ssh::exec::run_exec;
use tauri::State;
use tauri::Emitter;

const CONTAINER_NAME: &str = "minecraft-panel-server";

#[tauri::command]
pub async fn console_subscribe(app: tauri::AppHandle, state: State<'_, SshState>) -> Result<(), AppError> {
    let mut task_guard = state.console_task.lock().await;

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
    let stream_cmd = format!("docker logs -f --tail 200 {} 2>&1", CONTAINER_NAME);
    channel.exec(true, stream_cmd.as_str()).await?;
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
                            let lines: Vec<&str> = text.lines()
                                .filter(|l| !l.is_empty() && !l.contains("No such container") && !l.contains("permission denied"))
                                .collect();
                            if !lines.is_empty() {
                                let _ = app.emit("console-lines", lines);
                            }
                        }
                        Some(_) => {}
                        None => break,
                    }
                }
            }
        }
    });

    *state.console_task.lock().await = Some(tx);
    Ok(())
}

#[tauri::command]
pub async fn console_send_command(cmd: String, state: State<'_, SshState>) -> Result<(), AppError> {
    let raw_cmd = cmd.trim();
    let clean_cmd = if raw_cmd.starts_with('/') {
        &raw_cmd[1..]
    } else {
        raw_cmd
    };
    if clean_cmd.is_empty() {
        return Ok(());
    }

    let escaped_cmd = clean_cmd.replace("\"", "\\\"");

    let send_script = format!(r#"bash -c '
CMD="{0}"
# 1. Direct rcon-cli with explicit credentials
docker exec -i {1} rcon-cli --port 25575 --password minecraft "$CMD" >/dev/null 2>&1
if [ $? -eq 0 ]; then exit 0; fi

# 2. Standard rcon-cli invocation
docker exec -i {1} rcon-cli "$CMD" >/dev/null 2>&1
if [ $? -eq 0 ]; then exit 0; fi

# 3. Piped echo into rcon-cli
echo "$CMD" | docker exec -i {1} rcon-cli >/dev/null 2>&1
if [ $? -eq 0 ]; then exit 0; fi

# 4. Direct write to Java STDIN inside Docker container
docker exec -i {1} sh -c "JAVA_PID=\$(pgrep -f java | head -1); if [ -n \"\$JAVA_PID\" ]; then echo \"$CMD\" > /proc/\$JAVA_PID/fd/0; else echo \"$CMD\" > /proc/1/fd/0; fi" 2>/dev/null
'"#, escaped_cmd, CONTAINER_NAME);

    run_exec(&state, &send_script).await?;
    Ok(())
}

#[tauri::command]
pub async fn console_unsubscribe(state: State<'_, SshState>) -> Result<(), AppError> {
    let mut task_guard = state.console_task.lock().await;
    if let Some(tx) = task_guard.take() {
        let _ = tx.send(());
    }
    Ok(())
}
