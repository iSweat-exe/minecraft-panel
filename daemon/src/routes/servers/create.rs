use anyhow::Context;
use axum::extract::State;
use axum::Json;
use protocol::{ApiResponse, CreateServerRequest};

use crate::auth::NodeAuth;
use crate::routes::AppState;

pub async fn create_server(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Json(payload): Json<CreateServerRequest>,
) -> Json<ApiResponse<String>> {
    match state
        .docker
        .create_server_container(&payload.spec)
        .await
        .context("Failed to create server container")
    {
        Ok(container_id) => Json(ApiResponse::ok(container_id)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
