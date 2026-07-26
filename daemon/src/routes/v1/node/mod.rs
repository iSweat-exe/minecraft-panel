pub mod allocations;
pub mod crontab;
pub mod health;
pub mod host;
pub mod info;
pub mod logs;
pub mod memory;
pub mod metrics;
pub mod pty;
pub mod update;

use crate::routes::AppState;
use axum::routing::{get, post};
use axum::Router;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/node/info", get(info::get_info))
        .route("/api/v1/node/metrics", get(metrics::get_metrics))
        .route("/api/v1/node/update", post(update::trigger_update))
        .route(
            "/api/v1/node/allocations",
            get(allocations::list_allocations),
        )
        .route(
            "/api/v1/node/crontab",
            get(crontab::get_crontab).put(crontab::update_crontab),
        )
        .route("/api/v1/node/memory", get(memory::get_memory))
        .route("/api/v1/node/host", get(host::get_host))
        .route("/api/v1/node/host/exec", post(host::execute_command))
        .route("/api/v1/node/host/pty", get(pty::host_pty_ws))
        .route("/api/v1/node/health", get(health::get_health))
        .route("/api/v1/node/logs", get(logs::get_logs))
}
