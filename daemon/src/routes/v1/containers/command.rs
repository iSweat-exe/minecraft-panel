use anyhow::Context;
use axum::extract::{Path, State};
use axum::Json;
use protocol::ApiResponse;

use crate::auth::UserAuth;
use crate::error::DaemonError;
use crate::routes::AppState;

#[derive(serde::Deserialize)]
pub struct ServerCommandRequest {
    pub command: String,
}

#[derive(serde::Deserialize)]
pub struct ServerRconMultiRequest {
    pub commands: Vec<String>,
}

pub async fn server_command(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Json(payload): Json<ServerCommandRequest>,
) -> Result<Json<ApiResponse<String>>, DaemonError> {
    auth.require_permission("server:console")?;
    state
        .console_mgr
        .send_command(&server_id, &payload.command)
        .await
        .context(format!("Failed to send command to server {}", server_id))?;
    Ok(Json(ApiResponse::ok("Command sent".to_string())))
}

pub async fn server_rcon_multi(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Json(payload): Json<ServerRconMultiRequest>,
) -> Result<Json<ApiResponse<Vec<String>>>, DaemonError> {
    auth.require_permission("server:console")?;
    let mut responses = Vec::new();
    let container_name = crate::docker::DockerManager::container_name(&server_id);

    for cmd in payload.commands {
        let args = vec!["exec", "-i", &container_name, "rcon-cli", &cmd];
        let output = state
            .docker
            .run_docker_command(&args)
            .await
            .context("Failed to execute RCON command")?;
        responses.push(output);
    }

    Ok(Json(ApiResponse::ok(responses)))
}
