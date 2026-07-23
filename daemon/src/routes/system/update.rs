use anyhow::Context;
use axum::Json;
use protocol::{ApiResponse, UpdateDaemonRequest, UpdateDaemonResponse};

use crate::auth::NodeAuth;

pub async fn trigger_update(
    _auth: NodeAuth,
    Json(payload): Json<UpdateDaemonRequest>,
) -> Json<ApiResponse<UpdateDaemonResponse>> {
    match crate::update::AutoUpdater::apply_update(payload)
        .await
        .context("Failed to apply daemon auto-update")
    {
        Ok(res) => Json(ApiResponse::ok(res)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
