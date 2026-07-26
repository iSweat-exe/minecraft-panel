use axum::extract::{Path, State};
use axum::Json;
use protocol::{ApiResponse, ServerStatusResponse};

use crate::error::DaemonError;
use crate::routes::AppState;
use crate::services::auth::NodeAuth;

pub async fn list_servers(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<ServerStatusResponse>>>, DaemonError> {
    let list = state.docker.list_managed_containers().await?;
    Ok(Json(ApiResponse::ok(list)))
}

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
