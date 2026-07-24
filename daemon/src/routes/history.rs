use axum::{extract::State, response::IntoResponse, routing::get, Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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

#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/history", get(list_history).post(save_history))
}

async fn list_history(State(state): State<AppState>) -> impl IntoResponse {
    let result =
        sqlx::query_as::<_, DbHistory>("SELECT * FROM history ORDER BY timestamp DESC LIMIT 50")
            .fetch_all(&state.db)
            .await;

    match result {
        Ok(rows) => {
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
            Json(ApiResponse {
                success: true,
                data: Some(history),
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

async fn save_history(
    State(state): State<AppState>,
    Json(payload): Json<HistoryEntry>,
) -> impl IntoResponse {
    let now = chrono::Utc::now().timestamp();
    let id = payload
        .id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let query_result = sqlx::query(
        "INSERT INTO history (id, user, user_id, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&payload.user)
    .bind(&payload.user_id)
    .bind(&payload.action)
    .bind(&payload.details)
    .bind(now)
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
