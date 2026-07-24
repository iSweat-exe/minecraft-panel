use crate::error::AppError;
use crate::models::PanelUser;
use crate::node_client::DaemonClient;
use sha2::{Digest, Sha256};

const DB_PATH: &str = "/minecraft/.panel_users/users.json";

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
    let client = DaemonClient::new(node_url.clone(), node_token.clone());

    // Ensure dir exists
    let _ = client
        .file_action("/minecraft/.panel_users", protocol::FileAction::Mkdir)
        .await;

    match client.read_file(DB_PATH).await {
        Ok(base64_text) => {
            use base64::Engine;
            let decoded = base64::engine::general_purpose::STANDARD
                .decode(&base64_text)
                .unwrap_or_default();
            let text = String::from_utf8(decoded).unwrap_or_default();
            let users: Vec<PanelUser> = serde_json::from_str(&text).unwrap_or_default();
            Ok(users)
        }
        Err(_) => Ok(Vec::new()),
    }
}

#[tauri::command]
pub async fn save_panel_user(
    node_url: String,
    node_token: String,
    mut user: PanelUser,
) -> Result<Vec<PanelUser>, AppError> {
    let client = DaemonClient::new(node_url.clone(), node_token.clone());

    let mut users = get_panel_users(node_url.clone(), node_token.clone()).await?;
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

    if user.created_at.is_none() {
        user.created_at = Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        );
    }

    if user.uuid.is_none() {
        user.uuid = existing_idx
            .and_then(|idx| users[idx].uuid.clone())
            .or_else(|| Some(uuid::Uuid::new_v4().to_string()));
    }

    if let Some(idx) = existing_idx {
        users[idx] = user;
    } else {
        users.push(user);
    }

    let json = serde_json::to_string(&users).map_err(|e| AppError::Message(e.to_string()))?;
    client.write_file(DB_PATH, json).await?;

    Ok(users)
}

#[tauri::command]
pub async fn delete_panel_user(
    node_url: String,
    node_token: String,
    username: String,
) -> Result<Vec<PanelUser>, AppError> {
    let client = DaemonClient::new(node_url.clone(), node_token.clone());
    let mut users = get_panel_users(node_url.clone(), node_token.clone()).await?;

    users.retain(|u| u.username != username);

    let json = serde_json::to_string(&users).map_err(|e| AppError::Message(e.to_string()))?;
    client.write_file(DB_PATH, json).await?;

    Ok(users)
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
