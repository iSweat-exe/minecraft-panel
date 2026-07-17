use crate::error::AppError;
use crate::state::SshState;
use crate::ssh::exec::run_exec;
use tauri::State;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceAction {
    Start,
    Stop,
    Restart,
}

impl ServiceAction {
    fn verb(&self) -> &'static str {
        match self {
            Self::Start => "start",
            Self::Stop => "stop",
            Self::Restart => "restart",
        }
    }
}

#[derive(Serialize)]
pub struct ServiceState {
    pub active_state: String,
    pub sub_state: String,
}

#[tauri::command]
pub async fn service_action(action: ServiceAction, state: State<'_, SshState>) -> Result<(), AppError> {
    run_exec(&state, &format!("systemctl --user {}", action.verb())).await?;
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
