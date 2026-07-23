use anyhow::Context;
use axum::extract::{Path, State};
use axum::Json;
use protocol::ApiResponse;

use crate::auth::NodeAuth;
use crate::routes::AppState;

pub async fn server_inspect(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<bollard::models::ContainerInspectResponse>> {
    match state
        .docker
        .docker_client()
        .inspect_container(&id, None)
        .await
        .context(format!("Failed to inspect server {}", id))
    {
        Ok(info) => Json(ApiResponse::ok(info)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
