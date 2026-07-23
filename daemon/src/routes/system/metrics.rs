use anyhow::Context;
use axum::Json;
use protocol::{ApiResponse, SystemMetricsResponse};

use crate::auth::NodeAuth;

pub async fn get_metrics(_auth: NodeAuth) -> Json<ApiResponse<SystemMetricsResponse>> {
    match crate::metrics::get_metrics().context("Failed to collect system metrics") {
        Ok(data) => Json(ApiResponse::ok(data)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
