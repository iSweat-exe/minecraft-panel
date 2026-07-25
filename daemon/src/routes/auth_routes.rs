use axum::{
    extract::State,
    Json,
};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use crate::AppState;
use sha2::{Digest, Sha256};
use bcrypt::{hash, verify, DEFAULT_COST};
use protocol::auth::DaemonClaims;
use jsonwebtoken::{encode, Header, EncodingKey};
use sqlx::Row;

#[derive(Deserialize)]
pub struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    token: String,
}

fn hash_password_legacy(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let result = hasher.finalize();
    result.iter().map(|b| format!("{:02x}", b)).collect()
}

fn hash_password(password: &str) -> String {
    hash(password, DEFAULT_COST).unwrap()
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, (StatusCode, String)> {
    let row = sqlx::query("SELECT username, password_hash, permissions FROM users WHERE username = ?")
        .bind(&payload.username)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(row) = row {
        let db_hash: Option<String> = row.get("password_hash");
        let permissions_str: String = row.get("permissions");
        
        if let Some(ref hash_str) = db_hash {
            let mut password_valid = false;
            
            if hash_str.starts_with('$') {
                password_valid = verify(payload.password.trim(), hash_str).unwrap_or(false);
            } else {
                let legacy_input = hash_password_legacy(payload.password.trim());
                if hash_str == &legacy_input {
                    password_valid = true;
                    // Migrate to bcrypt
                    let new_hash = hash_password(payload.password.trim());
                    let _ = sqlx::query("UPDATE users SET password_hash = ? WHERE username = ?")
                        .bind(new_hash)
                        .bind(&payload.username)
                        .execute(&state.db)
                        .await;
                }
            }
            
            if password_valid {
                let permissions: Vec<String> = serde_json::from_str(&permissions_str).unwrap_or_default();
                
                // Mint JWT for panel user
                let claims = DaemonClaims::new(
                    payload.username.clone(),
                    "*", // Panel users get a wildcard server_id for general API access
                    permissions,
                    86400 * 7, // 7 days
                );
                
                let token = encode(
                    &Header::default(),
                    &claims,
                    &EncodingKey::from_secret(state.config.jwt_secret.as_bytes()),
                ).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to create token".to_string()))?;
                
                return Ok(Json(LoginResponse { token }));
            }
        }
    }
    Err((StatusCode::UNAUTHORIZED, "Mot de passe incorrect ou utilisateur introuvable".to_string()))
}

pub fn router() -> axum::Router<AppState> {
    axum::Router::new().route("/api/auth/login", axum::routing::post(login))
}
