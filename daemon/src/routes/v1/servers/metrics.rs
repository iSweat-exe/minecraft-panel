use crate::routes::AppState;
use crate::services::auth::NodeAuth;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use protocol::{ApiResponse, ServerMetricsHistoryData, ServerMetricsHistoryResponse};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct MetricsHistoryQuery {
    pub hours: Option<u32>,
}

#[utoipa::path(
    summary = "Server Metrics History",
    get,
    path = "/api/v1/servers/{server_id}/metrics/history",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    responses(
        (status = 200, description = "Get server metrics history", body = inline(protocol::ApiResponse<protocol::ServerMetricsHistoryResponse>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn server_metrics_history(
    State(state): State<AppState>,
    _auth: NodeAuth,
    Path(server_id): Path<String>,
    Query(query): Query<MetricsHistoryQuery>,
) -> Json<ApiResponse<ServerMetricsHistoryResponse>> {
    // NodeAuth implies full daemon access. Panel handles sub-user auth.

    let hours = query.hours.unwrap_or(24);
    let cutoff_timestamp = chrono::Utc::now().timestamp() - (hours as i64 * 3600);

    #[derive(sqlx::FromRow)]
    struct MetricRow {
        timestamp: i64,
        cpu_percent: f64,
        memory_used_bytes: i64,
        memory_limit_bytes: i64,
        disk_used_bytes: Option<i64>,
        network_rx_bytes: Option<i64>,
        network_tx_bytes: Option<i64>,
    }

    let rows = match sqlx::query_as::<_, MetricRow>(
        r#"
        SELECT timestamp, cpu_percent, memory_used_bytes, memory_limit_bytes, disk_used_bytes, network_rx_bytes, network_tx_bytes
        FROM server_metrics
        WHERE server_id = ? AND timestamp >= ?
        ORDER BY timestamp ASC
        "#,
    )
    .bind(&server_id)
    .bind(cutoff_timestamp)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("Failed to fetch server metrics history: {}", e);
            return Json(ApiResponse::err("Database error".to_string()));
        }
    };

    let history: Vec<ServerMetricsHistoryData> = rows
        .into_iter()
        .map(|r| ServerMetricsHistoryData {
            timestamp: r.timestamp as u64,
            cpu_percent: r.cpu_percent,
            memory_used_bytes: r.memory_used_bytes as u64,
            memory_limit_bytes: r.memory_limit_bytes as u64,
            disk_used_bytes: r.disk_used_bytes.unwrap_or(0) as u64,
            network_rx_bytes: r.network_rx_bytes.unwrap_or(0) as u64,
            network_tx_bytes: r.network_tx_bytes.unwrap_or(0) as u64,
        })
        .collect();

    Json(ApiResponse::ok(ServerMetricsHistoryResponse {
        server_id,
        history,
    }))
}
