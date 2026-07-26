use axum::extract::{Path, State};
use axum::Json;
use protocol::{ServerStatusResponse};

use crate::error::DaemonError;
use crate::routes::AppState;
use crate::services::auth::NodeAuth;

#[utoipa::path(
    tag = "Servers",
    summary = "Retrieve a list of all configured servers on the node",
    get,
    path = "/api/v1/servers",
    responses(
        (status = 200, description = "List servers", body = inline(protocol::Vec<protocol::ServerSpec>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn list_servers(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<ServerStatusResponse>>, DaemonError> {
    let list = state.docker.list_managed_containers().await?;
    Ok(Json(list))
}

#[utoipa::path(
    tag = "Servers",
    summary = "Retrieve detailed information about a specific server",
    get,
    path = "/api/v1/servers/{server_id}",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    responses(
        (status = 200, description = "Get server details", body = inline(protocol::ServerSpec))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_server(
    _auth: NodeAuth,
    Path(server_id): axum::extract::Path<String>,
    State(state): State<AppState>,
) -> Result<Json<ServerStatusResponse>, DaemonError> {
    let container = state.docker.get_managed_container(&server_id).await?;
    match container {
        Some(c) => Ok(Json(c)),
        None => Err(DaemonError::NotFound("Server not found".to_string())),
    }
}
