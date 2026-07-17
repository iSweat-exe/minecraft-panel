use crate::error::AppError;
use crate::state::SshState;
use crate::ssh::connection::SshHandler;
use russh::client::Config;
use std::sync::Arc;
use tauri::State;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionState {
    Connected,
    Disconnected,
    Reconnecting,
}

#[tauri::command]
pub async fn ssh_connect(
    host: String,
    port: u16,
    username: String,
    key_path: String,
    app_handle: tauri::AppHandle,
    state: State<'_, SshState>,
) -> Result<(), AppError> {
    // 1. Load the private key
    let key_pair = russh::keys::load_secret_key(&key_path, None)?;
    
    // 2. Setup config
    let config = Config::default();
    let config = Arc::new(config);
    
    let handler = SshHandler {
        expected_fingerprint: Some("SHA256:cKrSgYmNG4h+TV6lT/IlOYSOKIxQLhjXRnT4ykPRTok".to_string()),
        app_handle,
    };
    
    // 4. Connect
    let mut session = russh::client::connect(config, (host.as_str(), port), handler).await?;
    
    let auth_res = session.authenticate_publickey(
        username,
        russh::keys::PrivateKeyWithHashAlg::new(
            Arc::new(key_pair),
            session.best_supported_rsa_hash().await.unwrap_or(None).flatten(),
        )
    ).await?;
    
    if !matches!(auth_res, russh::client::AuthResult::Success) {
        return Err(AppError::Message("Authentication failed".into()));
    }
    // 6. Save session in state
    let mut guard = state.session.lock().await;
    *guard = Some(session);
    
    Ok(())
}

#[tauri::command]
pub async fn ssh_status(state: State<'_, SshState>) -> Result<ConnectionState, AppError> {
    let guard = state.session.lock().await;
    if guard.is_some() {
        Ok(ConnectionState::Connected)
    } else {
        Ok(ConnectionState::Disconnected)
    }
}

#[tauri::command]
pub async fn ssh_disconnect(state: State<'_, SshState>) -> Result<(), AppError> {
    let mut guard = state.session.lock().await;
    if let Some(session) = guard.take() {
        let _ = session.disconnect(russh::Disconnect::ByApplication, "", "English").await;
    }
    Ok(())
}
