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
    pub uuid: String,
    pub name: String,
    pub avatar: Option<String>,
    pub connected_at: i64,
    pub last_seen: i64,
    pub ip: String,
    pub ipv6: Option<String>,
    pub location: String,
    pub os: String,
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
        .route("/api/sessions/{id}", delete(delete_session))
}

#[derive(sqlx::FromRow)]
struct DbSession {
    uuid: String,
    name: String,
    avatar: Option<String>,
    connected_at: i64,
    last_seen: i64,
    ip: String,
    ipv6: Option<String>,
    location: String,
    os: String,
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
                    uuid: row.uuid,
                    name: row.name,
                    avatar: row.avatar,
                    connected_at: row.connected_at,
                    last_seen: row.last_seen,
                    ip: row.ip,
                    ipv6: row.ipv6,
                    location: row.location,
                    os: row.os,
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
        "INSERT INTO sessions (uuid, name, avatar, connected_at, last_seen, ip, ipv6, location, os) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
         ON CONFLICT(uuid) DO UPDATE SET last_seen = excluded.last_seen, name = excluded.name, avatar = excluded.avatar, ip = excluded.ip, ipv6 = excluded.ipv6, location = excluded.location, os = excluded.os"
    )
    .bind(&payload.uuid)
    .bind(&payload.name)
    .bind(&payload.avatar)
    .bind(payload.connected_at)
    .bind(payload.last_seen)
    .bind(&payload.ip)
    .bind(&payload.ipv6)
    .bind(&payload.location)
    .bind(&payload.os)
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
    Path(uuid): Path<String>,
) -> impl IntoResponse {
    let query_result = sqlx::query("DELETE FROM sessions WHERE uuid = ?")
        .bind(&uuid)
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
