use crate::error::AppError;
use crate::state::SshState;
use crate::ssh::exec::run_exec;
use tauri::State;
use crate::models::{ServiceAction, ServiceState};

#[tauri::command]
pub async fn service_action(action: ServiceAction, state: State<'_, SshState>) -> Result<(), AppError> {
    run_exec(&state, &format!("systemctl --user {} minecraft", action.verb())).await?;
    Ok(())
}

#[tauri::command]
pub async fn service_status(state: State<'_, SshState>) -> Result<ServiceState, AppError> {
    let out = run_exec(&state, "systemctl --user show minecraft --property=ActiveState,SubState --value").await?;
    let mut lines = out.lines();
    
    let active_state = lines.next().unwrap_or("unknown").trim().to_string();
    let sub_state = lines.next().unwrap_or("unknown").trim().to_string();
    
    Ok(ServiceState { active_state, sub_state })
}
