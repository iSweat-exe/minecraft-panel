use anyhow::Context;
use axum::extract::{Path, State};
use axum::Json;
use protocol::{ApiResponse, PowerActionRequest, PowerActionResponse};

use crate::auth::NodeAuth;
use crate::routes::AppState;

pub async fn server_power(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<PowerActionRequest>,
) -> Json<ApiResponse<PowerActionResponse>> {
    let action = payload.action;
    match state
        .docker
        .power_action(&id, action.clone())
        .await
        .context(format!(
            "Failed to execute power action '{:?}' on server {}",
            action, id
        )) {
        Ok(_) => Json(ApiResponse::ok(PowerActionResponse {
            server_id: id,
            action,
            success: true,
            message: "Action executed successfully".to_string(),
        })),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
