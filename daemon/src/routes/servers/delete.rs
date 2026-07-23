use anyhow::Context;
use axum::extract::{Path, State};
use axum::Json;
use protocol::ApiResponse;

use crate::auth::NodeAuth;
use crate::routes::AppState;

pub async fn delete_server(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<String>> {
    match state
        .docker
        .remove_container(&id)
        .await
        .context(format!("Failed to remove server {}", id))
    {
        Ok(_) => Json(ApiResponse::ok(format!("Server {} removed", id))),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
