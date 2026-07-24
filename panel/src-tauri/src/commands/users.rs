use crate::error::AppError;
use crate::models::PanelUser;
use crate::node_client::DaemonClient;
use sha2::{Digest, Sha256};

fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let result = hasher.finalize();
    result.iter().map(|b| format!("{:02x}", b)).collect()
}

#[tauri::command]
pub async fn get_panel_users(
    node_url: String,
    node_token: String,
) -> Result<Vec<PanelUser>, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.get_users().await
}

#[tauri::command]
pub async fn save_panel_user(
    node_url: String,
    node_token: String,
    mut user: PanelUser,
) -> Result<Vec<PanelUser>, AppError> {
    let client = DaemonClient::new(node_url.clone(), node_token.clone());

    let users = client.get_users().await?;
    let existing_idx = users.iter().position(|u| u.username == user.username);

    let password_hash = if let Some(ref raw_pwd) = user.password {
        if !raw_pwd.trim().is_empty() {
            Some(hash_password(raw_pwd.trim()))
        } else {
            existing_idx.and_then(|idx| users[idx].password_hash.clone())
        }
    } else {
        existing_idx.and_then(|idx| users[idx].password_hash.clone())
    };

    user.password_hash = password_hash;
    user.password = None;

    client.save_user(&user).await
}

#[tauri::command]
pub async fn delete_panel_user(
    node_url: String,
    node_token: String,
    username: String,
) -> Result<Vec<PanelUser>, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.delete_user(&username).await
}

#[tauri::command]
pub async fn verify_panel_user(
    node_url: String,
    node_token: String,
    username: String,
    password: String,
) -> Result<PanelUser, AppError> {
    let users = get_panel_users(node_url, node_token).await?;
    let target = users
        .into_iter()
        .find(|u| u.username.to_lowercase() == username.to_lowercase());

    match target {
        Some(user) => {
            let input_hash = hash_password(password.trim());
            if let Some(ref db_hash) = user.password_hash {
                if db_hash == &input_hash {
                    return Ok(user);
                }
            }
            Err(AppError::Message("Mot de passe incorrect".into()))
        }
        None => Err(AppError::Message("Utilisateur non trouvé".into())),
    }
}
