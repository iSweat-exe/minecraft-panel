pub mod crontab;
pub mod docker;
pub mod health;
pub mod host;
pub mod info;
pub mod logs;
pub mod memory;
pub mod metrics;
pub mod update;

use crate::routes::AppState;
use axum::routing::{get, post};
use axum::Router;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/info", get(info::get_info))
        .route("/api/v1/metrics", get(metrics::get_metrics))
        .route("/api/v1/update", post(update::trigger_update))
        .route(
            "/api/v1/system/crontab",
            get(crontab::get_crontab).put(crontab::update_crontab),
        )
        .route(
            "/api/v1/system/docker-config",
            get(docker::get_docker_config).put(docker::update_docker_config),
        )
        .route("/api/v1/system/memory", get(memory::get_memory))
        .route("/api/v1/system/host", get(host::get_host))
        .route("/api/v1/system/health", get(health::get_health))
        .route("/api/v1/system/logs", get(logs::get_logs))
        .route(
            "/api/v1/system/docker/containers",
            get(docker::list_all_containers).post(docker::run_container),
        )
        .route(
            "/api/v1/system/docker/containers/:id",
            axum::routing::put(docker::update_container)
        )
        .route(
            "/api/v1/system/docker/containers/:id/recreate",
            post(docker::recreate_container)
        )
        .route(
            "/api/v1/system/docker/containers/:id/action",
            post(docker::container_action),
        )
        .route(
            "/api/v1/system/docker/containers/:id/logs",
            get(docker::container_logs),
        )
        .route(
            "/api/v1/system/docker/containers/:id/inspect",
            get(docker::container_inspect),
        )
        .route(
            "/api/v1/system/docker/images",
            get(docker::list_all_images),
        )
        .route(
            "/api/v1/system/docker/images/pull",
            post(docker::pull_image),
        )
        .route(
            "/api/v1/system/docker/images/:id",
            axum::routing::delete(docker::remove_image),
        )
        .route(
            "/api/v1/system/docker/prune",
            post(docker::system_prune),
        )
}
