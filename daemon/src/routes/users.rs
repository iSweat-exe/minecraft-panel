use axum::{
    extract::{Path, State},
    response::IntoResponse,
    routing::{delete, get},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::NodeAuth;
use crate::routes::AppState;

#[derive(Serialize, Deserialize, Clone)]
pub struct UserResponse {
    pub uuid: Option<String>,
    pub username: String,
    pub role: String,
    pub permissions: Vec<String>,
    pub created_at: Option<i64>,
    pub password_hash: Option<String>,
    pub avatar_base64: Option<String>,
    pub display_name: Option<String>,
}

#[derive(Deserialize, Clone)]
pub struct CreateUserRequest {
    pub uuid: Option<String>,
    pub username: String,
    pub role: String,
    pub permissions: Vec<String>,
    pub password_hash: Option<String>,
    pub avatar_base64: Option<String>,
    pub display_name: Option<String>,
}

use protocol::ApiResponse;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/users", get(list_users).post(save_user))
        .route("/api/users/{username}", delete(delete_user))
}

#[derive(sqlx::FromRow)]
struct DbUser {
    uuid: String,
    username: String,
    role: String,
    permissions: String,
    created_at: i64,
    password_hash: Option<String>,
    avatar_base64: Option<String>,
    display_name: Option<String>,
}

async fn list_users(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<UserResponse>>>, crate::error::DaemonError> {
    let rows = sqlx::query_as::<_, DbUser>("SELECT * FROM users")
        .fetch_all(&state.db)
        .await?;

    let mut users = Vec::new();
    for row in rows {
        let permissions: Vec<String> =
            serde_json::from_str(&row.permissions).unwrap_or_else(|_| vec![]);
        users.push(UserResponse {
            uuid: Some(row.uuid),
            username: row.username,
            role: row.role,
            permissions,
            created_at: Some(row.created_at),
            password_hash: row.password_hash,
            avatar_base64: row.avatar_base64,
            display_name: row.display_name,
        });
    }
    
    Ok(Json(ApiResponse {
        success: true,
        data: Some(users),
        error: None,
    }))
}

async fn save_user(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<ApiResponse<Vec<UserResponse>>>, crate::error::DaemonError> {
    let now = chrono::Utc::now().timestamp();
    let uuid = payload.uuid.unwrap_or_else(|| Uuid::new_v4().to_string());
    let perms_json =
        serde_json::to_string(&payload.permissions).unwrap_or_else(|_| "[]".to_string());

    #[derive(sqlx::FromRow)]
    struct UuidRow {
        uuid: String,
    }

    let existing = sqlx::query_as::<_, UuidRow>("SELECT uuid FROM users WHERE username = ?")
        .bind(&payload.username)
        .fetch_optional(&state.db)
        .await?;

    // Prevent creating a new user with the reserved root username
    if payload.username == "iSweat" && existing.is_none() {
        return Err(crate::error::DaemonError::Custom("Le pseudo 'iSweat' est réservé au compte root".into()));
    }

    if let Some(row) = existing {
        sqlx::query(
            "UPDATE users SET role = ?, permissions = ?, password_hash = COALESCE(?, password_hash), avatar_base64 = ?, display_name = ? WHERE uuid = ?"
        )
        .bind(&payload.role)
        .bind(&perms_json)
        .bind(&payload.password_hash)
        .bind(&payload.avatar_base64)
        .bind(&payload.display_name)
        .bind(&row.uuid)
        .execute(&state.db)
        .await?;
    } else {
        sqlx::query(
            "INSERT INTO users (uuid, username, role, permissions, created_at, password_hash, avatar_base64, display_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&uuid)
        .bind(&payload.username)
        .bind(&payload.role)
        .bind(&perms_json)
        .bind(now)
        .bind(&payload.password_hash)
        .bind(&payload.avatar_base64)
        .bind(&payload.display_name)
        .execute(&state.db)
        .await?;
    }

    list_users(_auth, State(state)).await
}

async fn delete_user(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Json<ApiResponse<Vec<UserResponse>>>, crate::error::DaemonError> {
    if username == "iSweat" {
        return Err(crate::error::DaemonError::Custom("Le compte root 'iSweat' ne peut pas être supprimé".into()));
    }

    sqlx::query("DELETE FROM users WHERE username = ?")
        .bind(&username)
        .execute(&state.db)
        .await?;

    list_users(_auth, State(state)).await
}
