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
pub struct Automation {
    pub id: Option<String>,
    pub name: String,
    pub cron_expr: String,
    pub action_type: String, // e.g. "backup", "restart", "custom"
    pub target_server: Option<String>,
    pub payload: Option<String>,
    pub created_at: Option<i64>,
}

#[derive(sqlx::FromRow)]
struct DbAutomation {
    id: String,
    name: String,
    cron_expr: String,
    action_type: String,
    target_server: Option<String>,
    payload: Option<String>,
    created_at: i64,
}

#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/automations",
            get(list_automations).post(save_automation),
        )
        .route("/api/automations/{id}", delete(delete_automation))
}

async fn list_automations(State(state): State<AppState>) -> impl IntoResponse {
    let result = sqlx::query_as::<_, DbAutomation>("SELECT * FROM automations")
        .fetch_all(&state.db)
        .await;

    match result {
        Ok(rows) => {
            let mut automations = Vec::new();
            for row in rows {
                automations.push(Automation {
                    id: Some(row.id),
                    name: row.name,
                    cron_expr: row.cron_expr,
                    action_type: row.action_type,
                    target_server: row.target_server,
                    payload: row.payload,
                    created_at: Some(row.created_at),
                });
            }
            Json(ApiResponse {
                success: true,
                data: Some(automations),
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

async fn save_automation(
    State(state): State<AppState>,
    Json(payload): Json<Automation>,
) -> impl IntoResponse {
    let now = chrono::Utc::now().timestamp();
    let id = payload
        .id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let query_result = sqlx::query(
        "INSERT INTO automations (id, name, cron_expr, action_type, target_server, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, cron_expr = excluded.cron_expr, action_type = excluded.action_type, target_server = excluded.target_server, payload = excluded.payload"
    )
    .bind(&id)
    .bind(&payload.name)
    .bind(&payload.cron_expr)
    .bind(&payload.action_type)
    .bind(&payload.target_server)
    .bind(&payload.payload)
    .bind(now)
    .execute(&state.db)
    .await;

    // TODO: dynamically update tokio-cron-scheduler

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

async fn delete_automation(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let query_result = sqlx::query("DELETE FROM automations WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await;

    // TODO: dynamically remove from tokio-cron-scheduler

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
