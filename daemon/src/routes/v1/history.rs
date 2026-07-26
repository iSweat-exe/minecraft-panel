use axum::{extract::State, routing::get, Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::routes::AppState;
use crate::services::auth::NodeAuth;

#[derive(Serialize, Deserialize, Clone, utoipa::ToSchema)]
pub struct HistoryEntry {
    pub id: Option<String>,
    pub user: Option<String>,
    pub user_id: Option<String>,
    pub action: String,
    pub details: String,
    pub timestamp: Option<i64>,
}

#[derive(sqlx::FromRow)]
struct DbHistory {
    id: String,
    user: Option<String>,
    user_id: Option<String>,
    action: String,
    details: String,
    timestamp: i64,
}

impl From<DbHistory> for HistoryEntry {
    fn from(row: DbHistory) -> Self {
        Self {
            id: Some(row.id),
            user: row.user,
            user_id: row.user_id,
            action: row.action,
            details: row.details,
            timestamp: Some(row.timestamp),
        }
    }
}

use protocol::ApiResponse;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/v1/history", get(list_history).post(save_history))
}

#[utoipa::path(
    tag = "History",
    summary = "Retrieve a list of system or action histories",
    get,
    path = "/api/v1/history",
    responses(
        (status = 200, description = "List history entries", body = inline(ApiResponse<Vec<HistoryEntry>>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn list_history(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<HistoryEntry>>>, crate::error::DaemonError> {
    let rows =
        sqlx::query_as::<_, DbHistory>("SELECT * FROM history ORDER BY timestamp DESC LIMIT 50")
            .fetch_all(&state.db)
            .await?;

    let history: Vec<HistoryEntry> = rows.into_iter().map(Into::into).collect();

    Ok(Json(ApiResponse {
        success: true,
        data: Some(history),
        error: None,
    }))
}

#[utoipa::path(
    tag = "History",
    summary = "Create a new history record",
    post,
    path = "/api/v1/history",
    request_body = HistoryEntry,
    responses(
        (status = 200, description = "Save a history entry", body = inline(ApiResponse<HistoryEntry>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn save_history(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Json(payload): Json<HistoryEntry>,
) -> Result<Json<ApiResponse<HistoryEntry>>, crate::error::DaemonError> {
    let now = chrono::Utc::now().timestamp();
    let id = payload
        .id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    sqlx::query(
        "INSERT INTO history (id, user, user_id, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&payload.user)
    .bind(&payload.user_id)
    .bind(&payload.action)
    .bind(&payload.details)
    .bind(payload.timestamp.unwrap_or(now))
    .execute(&state.db)
    .await?;

    Ok(Json(ApiResponse {
        success: true,
        data: Some(payload),
        error: None,
    }))
}
