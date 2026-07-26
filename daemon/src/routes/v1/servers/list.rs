use axum::extract::{Path, State};
use axum::Json;
use protocol::{ApiResponse, ServerStatusResponse};

use crate::error::DaemonError;
use crate::routes::AppState;
use crate::services::auth::NodeAuth;

#[utoipa::path(
    summary = "List Servers",
    get,
    path = "/api/v1/servers",
    responses(
        (status = 200, description = "List servers", body = inline(protocol::ApiResponse<Vec<protocol::ServerSpec>>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn list_servers(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<ServerStatusResponse>>>, DaemonError> {
    let list = state.docker.list_managed_containers().await?;
    Ok(Json(ApiResponse::ok(list)))
}

#[utoipa::path(
    summary = "Get Server",
    get,
    path = "/api/v1/servers/{server_id}",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    responses(
        (status = 200, description = "Get server details", body = inline(protocol::ApiResponse<protocol::ServerSpec>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_server(
    _auth: NodeAuth,
    Path(server_id): axum::extract::Path<String>,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<ServerStatusResponse>>, DaemonError> {
    let container = state.docker.get_managed_container(&server_id).await?;
    match container {
        Some(c) => Ok(Json(ApiResponse::ok(c))),
        None => Err(DaemonError::NotFound("Server not found".to_string())),
    }
}
