use anyhow::Context;
use axum::Json;
use protocol::{ApiResponse, SystemMetricsResponse};

use crate::services::auth::NodeAuth;

#[utoipa::path(
    summary = "Get Metrics",
    get,
    path = "/api/v1/node/metrics",
    responses(
        (status = 200, description = "Get node metrics", body = inline(protocol::ApiResponse<protocol::SystemMetricsResponse>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_metrics(_auth: NodeAuth) -> Json<ApiResponse<SystemMetricsResponse>> {
    match crate::services::metrics::get_metrics()
        .await
        .context("Failed to collect system metrics")
    {
        Ok(data) => Json(ApiResponse::ok(data)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
