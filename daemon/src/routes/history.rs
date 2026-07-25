use axum::{extract::State, response::IntoResponse, routing::get, Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::NodeAuth;
use crate::routes::AppState;

#[derive(Serialize, Deserialize)]
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

use protocol::ApiResponse;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/history", get(list_history).post(save_history))
}

async fn list_history(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<HistoryEntry>>>, crate::error::DaemonError> {
    let rows =
        sqlx::query_as::<_, DbHistory>("SELECT * FROM history ORDER BY timestamp DESC LIMIT 50")
            .fetch_all(&state.db)
            .await?;

    let mut history = Vec::new();
    for row in rows {
        history.push(HistoryEntry {
            id: Some(row.id),
            user: row.user,
            user_id: row.user_id,
            action: row.action,
            details: row.details,
            timestamp: Some(row.timestamp),
        });
    }
    
    Ok(Json(ApiResponse {
        success: true,
        data: Some(history),
        error: None,
    }))
}

async fn save_history(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Json(payload): Json<HistoryEntry>,
) -> Result<Json<ApiResponse<HistoryEntry>>, crate::error::DaemonError> {
    let now = chrono::Utc::now().timestamp();
    let id = payload.id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());

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
