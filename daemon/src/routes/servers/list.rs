use anyhow::Context;
use axum::extract::State;
use axum::Json;
use protocol::{ApiResponse, ServerStatusResponse};

use crate::auth::NodeAuth;
use crate::routes::AppState;

pub async fn list_servers(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Json<ApiResponse<Vec<ServerStatusResponse>>> {
    match state
        .docker
        .list_managed_containers()
        .await
        .context("Failed to list managed containers")
    {
        Ok(list) => Json(ApiResponse::ok(list)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
