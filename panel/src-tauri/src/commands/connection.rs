use crate::error::AppError;
use crate::state::SshState;
use crate::ssh::handler::SshHandler;
use russh::client::Config;
use std::sync::Arc;
use tauri::State;
use crate::models::ConnectionState;

#[tauri::command]
pub async fn ssh_connect(
    host: String,
    port: u16,
    username: String,
    key_path: Option<String>,
    password: Option<String>,
    expected_fingerprint: Option<String>,
    app_handle: tauri::AppHandle,
    state: State<'_, SshState>,
) -> Result<(), AppError> {
    // 1. Setup config
    let config = Config::default();
    let config = Arc::new(config);
    
    let handler = SshHandler {
        expected_fingerprint,
        app_handle,
    };
    
    // 2. Connect
    let mut session = russh::client::connect(config, (host.as_str(), port), handler).await?;
    
    // 3. Authenticate using SSH Key or Password
    let has_key = key_path.as_ref().map(|k| !k.trim().is_empty()).unwrap_or(false);
    let has_pass = password.as_ref().map(|p| !p.trim().is_empty()).unwrap_or(false);

    let auth_res = if has_key {
        let path = key_path.unwrap();
        let key_pair = russh::keys::load_secret_key(path.trim(), None)?;
        session.authenticate_publickey(
            username.clone(),
            russh::keys::PrivateKeyWithHashAlg::new(
                Arc::new(key_pair),
                session.best_supported_rsa_hash().await.unwrap_or(None).flatten(),
            ),
        ).await?
    } else if has_pass {
        let pass = password.unwrap();
        session.authenticate_password(username.clone(), pass).await?
    } else {
        return Err(AppError::Message("Veuillez fournir une clé SSH ou un mot de passe".into()));
    };
    
    if !matches!(auth_res, russh::client::AuthResult::Success) {
        return Err(AppError::Message("Échec de l'authentification SSH (mot de passe ou clé invalide)".into()));
    }

    // 4. Save session in state
    let mut guard = state.session.lock().await;
    *guard = Some(session);

    let mut host_guard = state.host.lock().await;
    *host_guard = Some(host);
    
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
    
    let mut rcon_guard = state.rcon_channel.lock().await;
    if let Some(channel) = rcon_guard.take() {
        let _ = channel.eof().await;
        let _ = channel.close().await;
    }
    
    let mut sftp_guard = state.sftp.lock().await;
    *sftp_guard = None;
    
    // Abort streaming tasks gracefully
    if let Some(tx) = state.console_task.lock().await.take() {
        let _ = tx.send(());
    }
    if let Some(tx) = state.metrics_task.lock().await.take() {
        let _ = tx.send(());
    }
    
    Ok(())
}

#[tauri::command]
pub async fn ssh_execute(state: State<'_, SshState>, command: String) -> Result<String, AppError> {
    crate::ssh::exec::run_exec(&state, &command).await
}
