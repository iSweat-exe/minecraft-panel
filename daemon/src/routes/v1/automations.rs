use axum::{
    extract::{Path, State},
    routing::{delete, get},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::routes::AppState;
use crate::services::auth::NodeAuth;

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

impl From<DbAutomation> for Automation {
    fn from(row: DbAutomation) -> Self {
        Self {
            id: Some(row.id),
            name: row.name,
            cron_expr: row.cron_expr,
            action_type: row.action_type,
            target_server: row.target_server,
            payload: row.payload,
            created_at: Some(row.created_at),
        }
    }
}

use protocol::ApiResponse;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/automations",
            get(list_automations).post(save_automation),
        )
        .route("/api/v1/automations/{id}", delete(delete_automation))
}

async fn list_automations(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<Automation>>>, crate::error::DaemonError> {
    let rows = sqlx::query_as::<_, DbAutomation>("SELECT * FROM automations")
        .fetch_all(&state.db)
        .await?;

    let automations = rows.into_iter().map(Automation::from).collect();

    Ok(Json(ApiResponse {
        success: true,
        data: Some(automations),
        error: None,
    }))
}

async fn save_automation(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Json(payload): Json<Automation>,
) -> Result<Json<ApiResponse<Automation>>, crate::error::DaemonError> {
    let now = chrono::Utc::now().timestamp();
    let id = payload
        .id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    sqlx::query(
        "INSERT INTO automations (id, name, cron_expr, action_type, target_server, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, cron_expr = excluded.cron_expr, action_type = excluded.action_type, target_server = excluded.target_server, payload = excluded.payload"
    )
    .bind(&id)
    .bind(&payload.name)
    .bind(&payload.cron_expr)
    .bind(&payload.action_type)
    .bind(&payload.target_server)
    .bind(&payload.payload)
    .bind(payload.created_at.unwrap_or(now))
    .execute(&state.db)
    .await?;

    // Dynamically update scheduler
    if let Some(ref sched) = state.scheduler {
        let mut map = state.automation_jobs.write().await;
        if let Some(old_job_uuid) = map.remove(&id) {
            let _ = sched.remove(&old_job_uuid).await;
            tracing::info!("Removed old job for automation {}", id);
        }
    }

    if let Err(e) = crate::services::scheduler::schedule_automation_job(
        &state,
        id.clone(),
        payload.name.clone(),
        payload.cron_expr.clone(),
        payload.action_type.clone(),
        payload.target_server.clone(),
        payload.payload.clone(),
    )
    .await
    {
        tracing::error!("Failed to dynamically schedule automation {}: {}", id, e);
    }

    Ok(Json(ApiResponse {
        success: true,
        data: Some(payload),
        error: None,
    }))
}

async fn delete_automation(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Vec<Automation>>>, crate::error::DaemonError> {
    sqlx::query("DELETE FROM automations WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await?;

    // Dynamically remove scheduled job if scheduler is active
    if let Some(ref sched) = state.scheduler {
        let mut map = state.automation_jobs.write().await;
        if let Some(job_uuid) = map.remove(&id) {
            let _ = sched.remove(&job_uuid).await;
            tracing::info!("Removed job for deleted automation {}", id);
        }
    }

    list_automations(_auth, State(state)).await
}
