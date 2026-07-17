use crate::error::AppError;
use crate::state::SshState;

pub async fn run_exec(state: &tauri::State<'_, SshState>, command: &str) -> Result<String, AppError> {
    let mut guard = state.session.lock().await;
    let session = guard.as_mut().ok_or_else(|| AppError::Message("Not connected".into()))?;
    
    let mut channel = session.channel_open_session().await?;
    channel.exec(true, command).await?;
    
    let mut output = String::new();
    while let Some(msg) = channel.wait().await {
        if let russh::ChannelMsg::Data { data } = msg {
            output.push_str(&String::from_utf8_lossy(&data));
        }
    }
    
    Ok(output)
}
