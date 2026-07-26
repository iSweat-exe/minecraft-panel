use anyhow::Context;
use axum::Json;
use protocol::{SystemMetricsResponse};

use crate::services::auth::NodeAuth;

#[utoipa::path(
    tag = "Node Management",
    summary = "Retrieve system performance and resource utilization metrics",
    get,
    path = "/api/v1/node/metrics",
    responses(
        (status = 200, description = "Get node metrics", body = inline(protocol::SystemMetricsResponse))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_metrics(_auth: NodeAuth) -> Result<Json<SystemMetricsResponse>, crate::error::DaemonError> {
    match crate::services::metrics::get_metrics()
        .await
        .context("Failed to collect system metrics")
    {
        Ok(data) => Ok(Json(data)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}
