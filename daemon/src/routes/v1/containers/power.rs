use anyhow::Context;
use axum::extract::{Path, State};
use axum::Json;
use protocol::{ApiResponse, PowerActionRequest, PowerActionResponse};

use crate::auth::UserAuth;
use crate::error::DaemonError;
use crate::routes::AppState;

pub async fn server_power(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Json(payload): Json<PowerActionRequest>,
) -> Result<Json<ApiResponse<PowerActionResponse>>, DaemonError> {
    auth.require_permission("server:power")?;
    let action = payload.action;
    state
        .docker
        .power_action(&server_id, action.clone())
        .await
        .context(format!(
            "Failed to execute power action '{:?}' on server {}",
            action, server_id
        ))?;

    Ok(Json(ApiResponse::ok(PowerActionResponse {
        server_id,
        action,
        success: true,
        message: "Action executed successfully".to_string(),
    })))
}
