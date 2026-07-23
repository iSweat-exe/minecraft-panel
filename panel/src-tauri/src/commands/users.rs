use crate::error::AppError;
use crate::models::PanelUser;
use crate::state::SshState;
use crate::ssh::exec::run_exec;
use tauri::State;
use sha2::{Sha256, Digest};

const DB_PATH: &str = "/minecraft/.panel_users/panel.db";

fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let result = hasher.finalize();
    result.iter().map(|b| format!("{:02x}", b)).collect()
}

async fn init_db(state: &State<'_, SshState>) -> Result<(), AppError> {
    let script = format!(
        r#"mkdir -p /minecraft/.panel_users
which sqlite3 >/dev/null 2>&1 || (apt-get update -y && apt-get install -y sqlite3) 2>/dev/null || true
sqlite3 {0} "CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, role TEXT, permissions TEXT, password_hash TEXT, created_at INTEGER, avatar_base64 TEXT, display_name TEXT, uuid TEXT);" 2>/dev/null || true
sqlite3 {0} "ALTER TABLE users ADD COLUMN avatar_base64 TEXT;" 2>/dev/null || true
sqlite3 {0} "ALTER TABLE users ADD COLUMN display_name TEXT;" 2>/dev/null || true
sqlite3 {0} "ALTER TABLE users ADD COLUMN uuid TEXT;" 2>/dev/null || true
"#,
        DB_PATH
    );
    run_exec(state, &script).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_panel_users(state: State<'_, SshState>) -> Result<Vec<PanelUser>, AppError> {
    init_db(&state).await?;
    
    let query_cmd = format!(
        r#"sqlite3 {0} "SELECT username, role, permissions, password_hash, created_at, avatar_base64, display_name, uuid FROM users;" 2>/dev/null || echo ''"#,
        DB_PATH
    );
    let output = run_exec(&state, &query_cmd).await?;
    let mut users = Vec::new();

    for line in output.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 5 {
            let username = parts[0].to_string();
            let role = parts[1].to_string();
            let permissions: Vec<String> = serde_json::from_str(parts[2]).unwrap_or_default();
            let password_hash = if parts[3].is_empty() { None } else { Some(parts[3].to_string()) };
            let created_at = parts[4].parse::<u64>().ok();
            let avatar_base64 = if parts.len() > 5 && !parts[5].is_empty() { Some(parts[5].to_string()) } else { None };
            let display_name = if parts.len() > 6 && !parts[6].is_empty() { Some(parts[6].to_string()) } else { None };
            let mut user_uuid = if parts.len() > 7 && !parts[7].is_empty() { Some(parts[7].to_string()) } else { None };

            if user_uuid.is_none() {
                let generated = uuid::Uuid::new_v4().to_string();
                let update_sql = format!(
                    "UPDATE users SET uuid = '{0}' WHERE username = '{1}';",
                    generated,
                    username.replace("'", "''")
                );
                let script = format!(r#"sqlite3 {0} "{1}""#, DB_PATH, update_sql);
                let _ = run_exec(&state, &script).await;
                user_uuid = Some(generated);
            }

            users.push(PanelUser {
                uuid: user_uuid,
                username,
                role,
                permissions,
                created_at,
                password_hash,
                password: None,
                avatar_base64,
                display_name,
            });
        }
    }

    Ok(users)
}

#[tauri::command]
pub async fn save_panel_user(user: PanelUser, state: State<'_, SshState>) -> Result<Vec<PanelUser>, AppError> {
    init_db(&state).await?;

    let existing_users = get_panel_users(state.clone()).await?;
    let existing = existing_users.iter().find(|u| u.username == user.username);

    let password_hash = if let Some(ref raw_pwd) = user.password {
        if !raw_pwd.trim().is_empty() {
            hash_password(raw_pwd.trim())
        } else {
            existing.and_then(|u| u.password_hash.clone()).unwrap_or_default()
        }
    } else {
        existing.and_then(|u| u.password_hash.clone()).unwrap_or_default()
    };

    let perms_json = serde_json::to_string(&user.permissions).unwrap_or_else(|_| "[]".to_string());
    let created_at = user.created_at.unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    });

    let avatar = user.avatar_base64.or_else(|| existing.and_then(|e| e.avatar_base64.clone())).unwrap_or_default();
    let display = user.display_name.or_else(|| existing.and_then(|e| e.display_name.clone())).unwrap_or_default();
    let user_uuid = user.uuid
        .or_else(|| existing.and_then(|e| e.uuid.clone()))
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let sql = format!(
        r#"INSERT OR REPLACE INTO users (username, role, permissions, password_hash, created_at, avatar_base64, display_name, uuid) VALUES ('{0}', '{1}', '{2}', '{3}', {4}, '{5}', '{6}', '{7}');"#,
        user.username.replace("'", "''"),
        user.role.replace("'", "''"),
        perms_json.replace("'", "''"),
        password_hash.replace("'", "''"),
        created_at,
        avatar.replace("'", "''"),
        display.replace("'", "''"),
        user_uuid.replace("'", "''")
    );

    let script = format!(r#"sqlite3 {0} "{1}""#, DB_PATH, sql);
    run_exec(&state, &script).await?;

    get_panel_users(state).await
}

#[tauri::command]
pub async fn delete_panel_user(username: String, state: State<'_, SshState>) -> Result<Vec<PanelUser>, AppError> {
    init_db(&state).await?;

    let sql = format!(
        r#"DELETE FROM users WHERE username = '{0}';"#,
        username.replace("'", "''")
    );
    let script = format!(r#"sqlite3 {0} "{1}""#, DB_PATH, sql);
    run_exec(&state, &script).await?;

    get_panel_users(state).await
}

#[tauri::command]
pub async fn verify_panel_user(username: String, password: String, state: State<'_, SshState>) -> Result<PanelUser, AppError> {
    init_db(&state).await?;

    let users = get_panel_users(state).await?;
    let target = users.into_iter().find(|u| u.username.to_lowercase() == username.to_lowercase());

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
