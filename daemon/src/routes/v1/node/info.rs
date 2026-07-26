use anyhow::Context;
use axum::extract::State;
use axum::Json;
use protocol::{ApiResponse, DaemonInfoResponse};

use crate::routes::AppState;
use crate::services::auth::NodeAuth;

#[utoipa::path(
    tag = "Node Management",
    summary = "Retrieve general node information and capabilities",
    get,
    path = "/api/v1/node/info",
    responses(
        (status = 200, description = "Get node info", body = inline(protocol::ApiResponse<protocol::DaemonInfoResponse>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_info(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Json<ApiResponse<DaemonInfoResponse>> {
    let servers = match state
        .docker
        .list_managed_containers()
        .await
        .context("Failed to list managed containers")
    {
        Ok(s) => s,
        Err(e) => return Json(ApiResponse::err(format!("{:#}", e))),
    };
    let running = servers.iter().filter(|s| s.state == "running").count();

    let docker_version = state
        .docker
        .docker_client()
        .version()
        .await
        .ok()
        .and_then(|v| v.version)
        .unwrap_or_else(|| "Unknown".to_string());

    Json(ApiResponse::ok(DaemonInfoResponse {
        version: env!("CARGO_PKG_VERSION").to_string(),
        protocol_version: protocol::PROTOCOL_VERSION,
        node_id: state.config.node_id.clone(),
        docker_version,
        total_servers: servers.len(),
        running_servers: running,
        uptime_seconds: state.start_time.elapsed().as_secs(),
    }))
}
