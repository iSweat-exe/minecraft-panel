use anyhow::Context;
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::Json;
use protocol::ApiResponse;

use crate::auth::UserAuth;
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
    Path(id): Path<String>,
    Json(payload): Json<ServerCommandRequest>,
) -> axum::response::Response {
    if let Err(rejection) = auth.require_permission("server:console") {
        return (rejection.0, axum::Json(ApiResponse::<()>::err(rejection.1))).into_response();
    }
    match state
        .console_mgr
        .send_command(&id, &payload.command)
        .await
        .context(format!("Failed to send command to server {}", id))
    {
        Ok(_) => axum::Json(ApiResponse::ok("Command sent".to_string())).into_response(),
        Err(e) => axum::Json(ApiResponse::<String>::err(format!("{:#}", e))).into_response(),
    }
}

pub async fn server_rcon_multi(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<ServerRconMultiRequest>,
) -> axum::response::Response {
    if let Err(rejection) = auth.require_permission("server:console") {
        return (rejection.0, axum::Json(ApiResponse::<()>::err(rejection.1))).into_response();
    }
    let mut responses = Vec::new();
    let container_name = format!("mc-server-{}", id);

    for cmd in payload.commands {
        let args = vec!["exec", "-i", &container_name, "rcon-cli", &cmd];
        match state.docker.run_docker_command(&args).await {
            Ok(output) => responses.push(output),
            Err(e) => {
                return axum::Json(ApiResponse::<Vec<String>>::err(format!(
                    "Failed to execute RCON command: {:#}",
                    e
                ))).into_response();
            }
        }
    }

    axum::Json(ApiResponse::ok(responses)).into_response()
}
