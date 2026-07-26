use anyhow::Context;
use axum::extract::{Path, State};
use axum::Json;
use protocol::ApiResponse;

use crate::error::DaemonError;
use crate::routes::AppState;
use crate::services::auth::NodeAuth;

pub async fn server_inspect(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
) -> Result<Json<ApiResponse<bollard::models::ContainerInspectResponse>>, DaemonError> {
    let info = state
        .docker
        .docker_client()
        .inspect_container(&server_id, None)
        .await
        .context(format!("Failed to inspect server {}", server_id))?;
    Ok(Json(ApiResponse::ok(info)))
}
