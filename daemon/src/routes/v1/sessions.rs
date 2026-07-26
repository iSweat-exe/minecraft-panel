use axum::{
    extract::{Path, State},
    routing::{delete, get},
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::routes::AppState;
use crate::services::auth::NodeAuth;

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

use protocol::ApiResponse;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/sessions", get(list_sessions).post(save_session))
        .route("/api/v1/sessions/{id}", delete(delete_session))
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

impl From<DbSession> for Session {
    fn from(row: DbSession) -> Self {
        Self {
            uuid: row.uuid,
            name: row.name,
            avatar: row.avatar,
            connected_at: row.connected_at,
            last_seen: row.last_seen,
            ip: row.ip,
            ipv6: row.ipv6,
            location: row.location,
            os: row.os,
        }
    }
}

async fn list_sessions(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<Session>>>, crate::error::DaemonError> {
    let rows = sqlx::query_as::<_, DbSession>("SELECT * FROM sessions")
        .fetch_all(&state.db)
        .await?;

    let sessions: Vec<Session> = rows.into_iter().map(Into::into).collect();

    Ok(Json(ApiResponse {
        success: true,
        data: Some(sessions),
        error: None,
    }))
}

async fn save_session(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Json(payload): Json<Session>,
) -> Result<Json<ApiResponse<Session>>, crate::error::DaemonError> {
    sqlx::query(
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
    .await?;

    Ok(Json(ApiResponse {
        success: true,
        data: Some(payload),
        error: None,
    }))
}

async fn delete_session(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Vec<Session>>>, crate::error::DaemonError> {
    sqlx::query("DELETE FROM sessions WHERE uuid = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;

    list_sessions(_auth, State(state)).await
}
