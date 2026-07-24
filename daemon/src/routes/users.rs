use axum::{
    extract::{Path, State},
    response::IntoResponse,
    routing::{delete, get},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::routes::AppState;

#[derive(Serialize, Deserialize, Clone)]
pub struct PanelUser {
    pub uuid: Option<String>,
    pub username: String,
    pub role: String,
    pub permissions: Vec<String>,
    pub created_at: Option<i64>,
    pub password_hash: Option<String>,
    pub password: Option<String>,
    pub avatar_base64: Option<String>,
    pub display_name: Option<String>,
}

#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

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

async fn list_users(State(state): State<AppState>) -> impl IntoResponse {
    let users_result = sqlx::query_as::<_, DbUser>("SELECT * FROM users")
        .fetch_all(&state.db)
        .await;

    match users_result {
        Ok(rows) => {
            let mut users = Vec::new();
            for row in rows {
                let permissions: Vec<String> =
                    serde_json::from_str(&row.permissions).unwrap_or_default();
                users.push(PanelUser {
                    uuid: Some(row.uuid),
                    username: row.username,
                    role: row.role,
                    permissions,
                    created_at: Some(row.created_at),
                    password_hash: row.password_hash,
                    password: None,
                    avatar_base64: row.avatar_base64,
                    display_name: row.display_name,
                });
            }
            Json(ApiResponse {
                success: true,
                data: Some(users),
                error: None,
            })
            .into_response()
        }
        Err(e) => Json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some(e.to_string()),
        })
        .into_response(),
    }
}

async fn save_user(
    State(state): State<AppState>,
    Json(payload): Json<PanelUser>,
) -> impl IntoResponse {
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
        .await;

    if let Err(e) = existing {
        return Json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some(e.to_string()),
        })
        .into_response();
    }

    let existing = existing.unwrap();

    let query_result = if let Some(row) = existing {
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
        .await
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
        .await
    };

    match query_result {
        Ok(_) => list_users(State(state)).await.into_response(),
        Err(e) => Json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some(e.to_string()),
        })
        .into_response(),
    }
}

async fn delete_user(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> impl IntoResponse {
    let query_result = sqlx::query("DELETE FROM users WHERE username = ?")
        .bind(&username)
        .execute(&state.db)
        .await;

    match query_result {
        Ok(_) => list_users(State(state)).await.into_response(),
        Err(e) => Json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some(e.to_string()),
        })
        .into_response(),
    }
}
