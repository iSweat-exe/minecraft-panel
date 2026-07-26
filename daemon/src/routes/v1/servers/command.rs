use anyhow::Context;
use axum::extract::{Path, State};
use axum::Json;

use crate::error::DaemonError;
use crate::routes::AppState;
use crate::services::auth::UserAuth;

#[derive(serde::Deserialize, utoipa::ToSchema)]
pub struct ServerCommandRequest {
    pub command: String,
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
pub struct ServerRconMultiRequest {
    pub commands: Vec<String>,
}

#[utoipa::path(
    tag = "Servers",
    summary = "Execute a console command on a specific server",
    post,
    path = "/api/v1/servers/{server_id}/command",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    request_body = ServerCommandRequest,
    responses(
        (status = 200, description = "Send command to server console", body = inline(protocol::String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn server_command(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Json(payload): Json<ServerCommandRequest>,
) -> Result<Json<String>, DaemonError> {
    auth.require_permission("server:console")?;
    tracing::info!(server_id = %server_id, user = %auth.username, command = %payload.command, "Sending command to server");
    state
        .console_mgr
        .send_command(&server_id, &payload.command)
        .await
        .context(format!("Failed to send command to server {}", server_id))?;
    Ok(Json("Command sent".to_string()))
}

#[utoipa::path(
    tag = "Servers",
    summary = "Execute multiple RCON commands on a specific server",
    post,
    path = "/api/v1/servers/{server_id}/rcon",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    request_body = ServerRconMultiRequest,
    responses(
        (status = 200, description = "Send RCON command", body = inline(protocol::String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn server_rcon_multi(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Json(payload): Json<ServerRconMultiRequest>,
) -> Result<Json<Vec<String>>, DaemonError> {
    auth.require_permission("server:console")?;
    tracing::info!(server_id = %server_id, user = %auth.username, count = payload.commands.len(), "Executing RCON multi commands");
    let mut responses = Vec::new();
    let container_name = crate::services::docker::DockerManager::container_name(&server_id);

    for cmd in payload.commands {
        let args = vec!["exec", "-i", &container_name, "rcon-cli", &cmd];
        let output = state
            .docker
            .run_docker_command(&args)
            .await
            .context("Failed to execute RCON command")?;
        responses.push(output);
    }

    Ok(Json(responses))
}
