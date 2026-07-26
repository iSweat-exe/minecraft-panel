use axum::Json;
use protocol::{ApiResponse, SystemMemoryResponse};

use crate::services::auth::NodeAuth;

#[utoipa::path(
    tag = "Node Management",
    summary = "Retrieve current memory usage and limits of the host",
    get,
    path = "/api/v1/node/memory",
    responses(
        (status = 200, description = "Get node memory", body = inline(protocol::ApiResponse<protocol::SystemMemoryResponse>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_memory(_auth: NodeAuth) -> Json<ApiResponse<SystemMemoryResponse>> {
    let mut sys = sysinfo::System::new_with_specifics(
        sysinfo::RefreshKind::nothing().with_memory(sysinfo::MemoryRefreshKind::everything()),
    );
    sys.refresh_memory();
    let total_mb = sys.total_memory() / 1024 / 1024;
    let used_mb = sys.used_memory() / 1024 / 1024;
    let free_mb = total_mb.saturating_sub(used_mb);

    Json(ApiResponse::ok(SystemMemoryResponse {
        total_mb,
        free_mb,
        used_mb,
    }))
}
