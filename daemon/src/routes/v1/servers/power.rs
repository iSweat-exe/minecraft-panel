use anyhow::Context;
use axum::extract::{Path, State};
use axum::Json;
use protocol::{PowerActionRequest, PowerActionResponse};

use crate::error::DaemonError;
use crate::routes::AppState;
use crate::services::auth::UserAuth;

#[utoipa::path(
    tag = "Servers",
    summary = "Send a power action (start, stop, restart, kill) to a server",
    post,
    path = "/api/v1/servers/{server_id}/power",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    request_body = protocol::PowerActionRequest,
    responses(
        (status = 200, description = "Change server power state", body = inline(protocol::String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn server_power(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Json(payload): Json<PowerActionRequest>,
) -> Result<Json<PowerActionResponse>, DaemonError> {
    auth.require_permission("server:power")?;
    tracing::info!(server_id = %server_id, user = %auth.username, action = ?payload.action, "Power action requested");
    let action = payload.action;
    state
        .docker
        .power_action(&server_id, action.clone())
        .await
        .context(format!(
            "Failed to execute power action '{:?}' on server {}",
            action, server_id
        ))?;

    Ok(Json(PowerActionResponse {
        server_id,
        action,
        success: true,
        message: "Action executed successfully".to_string(),
    }))
}
