use crate::error::AppError;
use crate::models::McPing;
use crate::state::SshState;
use tauri::State;

#[tauri::command]
pub async fn mc_ping(state: State<'_, SshState>) -> Result<McPing, AppError> {
    let host = {
        let guard = state.host.lock().await;
        guard.clone()
    };

    let host = match host {
        Some(h) => h,
        None => {
            return Ok(McPing {
                online: false,
                players_online: None,
                players_max: None,
                latency_ms: None,
                sample: None,
            })
        }
    };

    crate::protocol::mc_ping::perform_ping(&host, &state).await
}
