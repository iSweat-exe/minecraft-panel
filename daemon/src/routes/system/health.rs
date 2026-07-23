use axum::extract::State;
use axum::Json;
use protocol::{ApiResponse, SystemHealthResponse};

use crate::auth::NodeAuth;
use crate::routes::AppState;

pub async fn get_health(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Json<ApiResponse<SystemHealthResponse>> {
    let docker_responsive = state.docker.docker_client().ping().await.is_ok();

    let disks = sysinfo::Disks::new_with_refreshed_list();
    let mut disk_total_mb = 0;
    let mut disk_free_mb = 0;
    for disk in disks.list() {
        disk_total_mb += disk.total_space() / 1024 / 1024;
        disk_free_mb += disk.available_space() / 1024 / 1024;
    }

    // Warning if less than 5% free
    let disk_space_warning = if disk_total_mb > 0 {
        let free_percent = (disk_free_mb as f64 / disk_total_mb as f64) * 100.0;
        free_percent < 5.0
    } else {
        false
    };

    Json(ApiResponse::ok(SystemHealthResponse {
        docker_responsive,
        disk_space_warning,
    }))
}
