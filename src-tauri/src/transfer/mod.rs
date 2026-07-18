pub mod upload;
pub mod download;

use crate::error::AppError;
use crate::state::SshState;
use tauri::State;

#[tauri::command]
pub async fn cancel_backup(state: State<'_, SshState>) -> Result<(), AppError> {
    state.backup_cancel.store(true, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}
