use axum::extract::State;
use axum::Json;
use protocol::{ApiResponse, ServerStatusResponse};

use crate::auth::NodeAuth;
use crate::error::DaemonError;
use crate::routes::AppState;

pub async fn list_servers(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<ServerStatusResponse>>>, DaemonError> {
    let list = state.docker.list_managed_containers().await?;
    Ok(Json(ApiResponse::ok(list)))
}
