use crate::error::AppError;
use crate::state::SshState;
use tauri::State;

#[tauri::command]
pub async fn rcon_execute_multi(
    cmds: Vec<String>,
    port: u16,
    password: String,
    state: State<'_, SshState>,
) -> Result<Vec<String>, AppError> {
    crate::protocol::rcon::execute_multi(cmds, port, password, &state).await
}

#[tauri::command]
pub async fn rcon_execute(
    cmd: String,
    port: u16,
    password: String,
    state: State<'_, SshState>,
) -> Result<String, AppError> {
    let res = rcon_execute_multi(vec![cmd], port, password, state).await?;
    Ok(res.into_iter().next().unwrap_or_default())
}
