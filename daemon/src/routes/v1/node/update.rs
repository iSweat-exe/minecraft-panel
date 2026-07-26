use anyhow::Context;
use axum::Json;
use protocol::{UpdateDaemonRequest, UpdateDaemonResponse};

use crate::services::auth::NodeAuth;

#[utoipa::path(
    tag = "Node Management",
    summary = "Trigger a self-update process for the daemon node",
    post,
    path = "/api/v1/node/update",
    request_body = UpdateDaemonRequest,
    responses(
        (status = 200, description = "Trigger node update", body = inline(protocol::UpdateDaemonResponse))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn trigger_update(
    _auth: NodeAuth,
    Json(payload): Json<UpdateDaemonRequest>,
) -> Result<Json<UpdateDaemonResponse>, crate::error::DaemonError> {
    match crate::services::update::AutoUpdater::apply_update(payload)
        .await
        .context("Failed to apply daemon auto-update")
    {
        Ok(res) => Ok(Json(res)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}
