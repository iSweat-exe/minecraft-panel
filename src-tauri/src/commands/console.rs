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
    if let Some(handle) = task_guard.take() {
        handle.abort();
    }

    // Open a new channel while still holding task_guard (prevents a second
    // call from starting before we store the handle).
    let mut session_guard = state.session.lock().await;
    let session = session_guard.as_mut().ok_or_else(|| AppError::Message("Not connected".into()))?;

    let mut channel = session.channel_open_session().await?;
    channel.exec(true, "tail -F -n 200 /minecraft/logs/latest.log").await?;
    drop(session_guard);

    let handle = tauri::async_runtime::spawn(async move {
        while let Some(msg) = channel.wait().await {
            if let russh::ChannelMsg::Data { data } = msg {
                let text = String::from_utf8_lossy(&data);
                // Split chunks into individual lines so the frontend
                // receives one event per log line, not one per TCP packet.
                for line in text.lines() {
                    if !line.is_empty() {
                        let _ = app.emit("console-line", line);
                    }
                }
            }
        }
    });

    *task_guard = Some(handle);
    Ok(())
}

#[tauri::command]
pub async fn console_send_command(cmd: String, state: State<'_, SshState>) -> Result<(), AppError> {
    let escaped_cmd = cmd.replace("'", "'\\''");
    let screen_cmd = format!("screen -S minecraft -p 0 -X stuff '{}\\r'", escaped_cmd);
    run_exec(&state, &screen_cmd).await?;
    Ok(())
}
