use axum::{
    extract::{Path, State},
    response::IntoResponse,
    routing::{delete, get},
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::routes::AppState;

#[derive(Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub user_uuid: String,
    pub expires_at: i64,
    pub created_at: i64,
}

#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/sessions", get(list_sessions).post(save_session))
        .route("/api/sessions/:id", delete(delete_session))
}

#[derive(sqlx::FromRow)]
struct DbSession {
    id: String,
    user_uuid: String,
    expires_at: i64,
    created_at: i64,
}

async fn list_sessions(State(state): State<AppState>) -> impl IntoResponse {
    let result = sqlx::query_as::<_, DbSession>("SELECT * FROM sessions")
        .fetch_all(&state.db)
        .await;

    match result {
        Ok(rows) => {
            let mut sessions = Vec::new();
            for row in rows {
                sessions.push(Session {
                    id: row.id,
                    user_uuid: row.user_uuid,
                    expires_at: row.expires_at,
                    created_at: row.created_at,
                });
            }
            Json(ApiResponse {
                success: true,
                data: Some(sessions),
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

async fn save_session(
    State(state): State<AppState>,
    Json(payload): Json<Session>,
) -> impl IntoResponse {
    let query_result = sqlx::query(
        "INSERT INTO sessions (id, user_uuid, expires_at, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET expires_at = excluded.expires_at"
    )
    .bind(&payload.id)
    .bind(&payload.user_uuid)
    .bind(payload.expires_at)
    .bind(payload.created_at)
    .execute(&state.db)
    .await;

    match query_result {
        Ok(_) => Json(ApiResponse {
            success: true,
            data: Some(payload),
            error: None,
        })
        .into_response(),
        Err(e) => Json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some(e.to_string()),
        })
        .into_response(),
    }
}

async fn delete_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let query_result = sqlx::query("DELETE FROM sessions WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await;

    match query_result {
        Ok(_) => Json(ApiResponse::<()> {
            success: true,
            data: None,
            error: None,
        })
        .into_response(),
        Err(e) => Json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some(e.to_string()),
        })
        .into_response(),
    }
}
