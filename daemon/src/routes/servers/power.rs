use anyhow::Context;
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::Json;
use protocol::{ApiResponse, PowerActionRequest, PowerActionResponse};

use crate::auth::UserAuth;
use crate::routes::AppState;

pub async fn server_power(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<PowerActionRequest>,
) -> axum::response::Response {
    if let Err(rejection) = auth.require_permission("server:power") {
        return (rejection.0, axum::Json(ApiResponse::<()>::err(rejection.1))).into_response();
    }
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
        })).into_response(),
        Err(e) => Json(ApiResponse::<PowerActionResponse>::err(format!("{:#}", e))).into_response(),
    }
}
