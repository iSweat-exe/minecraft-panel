use anyhow::Context;
use axum::extract::State;
use axum::Json;
use protocol::{ApiResponse, DaemonInfoResponse};

use crate::auth::NodeAuth;
use crate::routes::AppState;

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

    Json(ApiResponse::ok(DaemonInfoResponse {
        version: env!("CARGO_PKG_VERSION").to_string(),
        protocol_version: protocol::PROTOCOL_VERSION,
        node_id: state.config.node_id.clone(),
        docker_version: "24.0".to_string(), // In a real app we could fetch this dynamically
        total_servers: servers.len(),
        running_servers: running,
        uptime_seconds: state.start_time.elapsed().as_secs(),
    }))
}
