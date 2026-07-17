use crate::error::AppError;
use crate::state::SshState;
use crate::ssh::exec::run_exec;
use tauri::State;
use tauri::Emitter;

#[tauri::command]
pub async fn console_subscribe(app: tauri::AppHandle, state: State<'_, SshState>) -> Result<(), AppError> {
    // Abort any previous console subscription to avoid duplicate lines
    {
        let mut task_guard = state.console_task.lock().await;
        if let Some(handle) = task_guard.take() {
            handle.abort();
        }
    }

    let mut guard = state.session.lock().await;
    let session = guard.as_mut().ok_or_else(|| AppError::Message("Not connected".into()))?;
    
    let mut channel = session.channel_open_session().await?;
    channel.exec(true, "tail -F -n 200 /minecraft/logs/latest.log").await?;
    
    let handle = tauri::async_runtime::spawn(async move {
        while let Some(msg) = channel.wait().await {
            if let russh::ChannelMsg::Data { data } = msg {
                let text = String::from_utf8_lossy(&data).to_string();
                let _ = app.emit("console-line", text);
            }
        }
    });

    // Store the handle so we can abort it on the next subscribe call
    {
        let mut task_guard = state.console_task.lock().await;
        *task_guard = Some(handle);
    }

    Ok(())
}

#[tauri::command]
pub async fn console_send_command(cmd: String, state: State<'_, SshState>) -> Result<(), AppError> {
    let escaped_cmd = cmd.replace("'", "'\\''");
    let screen_cmd = format!("screen -S minecraft -p 0 -X stuff '{}\\r'", escaped_cmd);
    run_exec(&state, &screen_cmd).await?;
    Ok(())
}
