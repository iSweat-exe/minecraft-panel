use anyhow::Context;
use axum::Json;
use protocol::{ApiResponse, UpdateDaemonRequest, UpdateDaemonResponse};

use crate::services::auth::NodeAuth;

#[utoipa::path(
    summary = "Trigger Update",
    post,
    path = "/api/v1/node/update",
    request_body = UpdateDaemonRequest,
    responses(
        (status = 200, description = "Trigger node update", body = inline(protocol::ApiResponse<UpdateDaemonResponse>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn trigger_update(
    _auth: NodeAuth,
    Json(payload): Json<UpdateDaemonRequest>,
) -> Json<ApiResponse<UpdateDaemonResponse>> {
    match crate::services::update::AutoUpdater::apply_update(payload)
        .await
        .context("Failed to apply daemon auto-update")
    {
        Ok(res) => Json(ApiResponse::ok(res)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
