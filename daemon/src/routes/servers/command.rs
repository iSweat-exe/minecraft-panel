use anyhow::Context;
use axum::extract::{Path, State};
use axum::Json;
use protocol::ApiResponse;
use std::sync::Arc;

use crate::auth::NodeAuth;
use crate::routes::AppState;

#[derive(serde::Deserialize)]
pub struct ServerCommandRequest {
    pub command: String,
}

pub async fn server_command(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<ServerCommandRequest>,
) -> Json<ApiResponse<String>> {
    let console_mgr =
        crate::console::ConsoleStreamManager::new(Arc::new(state.docker.docker_client().clone()));
    match console_mgr
        .send_command(&id, &payload.command)
        .await
        .context(format!("Failed to send command to server {}", id))
    {
        Ok(_) => Json(ApiResponse::ok("Command sent".to_string())),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
