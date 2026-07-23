use axum::Json;
use protocol::{ApiResponse, SystemMemoryResponse};

use crate::auth::NodeAuth;

pub async fn get_memory(_auth: NodeAuth) -> Json<ApiResponse<SystemMemoryResponse>> {
    let mut sys = sysinfo::System::new();
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
