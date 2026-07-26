use anyhow::Context;
use axum::extract::{Path, State};
use axum::Json;

use crate::error::DaemonError;
use crate::routes::AppState;
use crate::services::auth::NodeAuth;

#[utoipa::path(
    tag = "Servers",
    summary = "Retrieve detailed configuration and status information for a server",
    get,
    path = "/api/v1/servers/{server_id}/inspect",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    responses(
        (status = 200, description = "Inspect server container")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn server_inspect(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
) -> Result<Json<bollard::models::ContainerInspectResponse>, DaemonError> {
    let info = state
        .docker
        .docker_client()
        .inspect_container(&server_id, None)
        .await
        .context(format!("Failed to inspect server {}", server_id))?;
    Ok(Json(info))
}
