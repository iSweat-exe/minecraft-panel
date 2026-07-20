use crate::error::AppError;
use crate::state::SshState;
use crate::ssh::exec::run_exec;
use tauri::State;
use tauri::Emitter;

#[tauri::command]
pub async fn console_subscribe(app: tauri::AppHandle, state: State<'_, SshState>) -> Result<(), AppError> {
    // Hold the task lock for the ENTIRE operation to prevent races with
    // React StrictMode double-mounting.
    let mut task_guard = state.console_task.lock().await;

    // Abort any previous subscription
    if let Some(tx) = task_guard.take() {
        let _ = tx.send(());
    }
    drop(task_guard);

    // Open a new channel
    let mut session_guard = state.session.lock().await;
    let session = session_guard.as_mut().ok_or_else(|| AppError::Message("Not connected".into()))?;

    let mut channel = session.channel_open_session().await?;
    channel.exec(true, "tail -F -n 200 /minecraft/logs/latest.log").await?;
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
                            // Send lines as a single batch to avoid flooding the frontend with individual IPC events.
                            let lines: Vec<&str> = text.lines().filter(|l| !l.is_empty()).collect();
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
    let escaped_cmd = cmd.replace("'", "'\\''");
    let screen_cmd = format!("screen -S minecraft -p 0 -X stuff '{}\\r'", escaped_cmd);
    run_exec(&state, &screen_cmd).await?;
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
