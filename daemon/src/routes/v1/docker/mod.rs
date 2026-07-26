pub mod config;
pub mod containers;
pub mod images;

use crate::routes::AppState;
use axum::routing::{delete, get, post, put};
use axum::Router;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/docker/config",
            get(config::get_docker_config).put(config::update_docker_config),
        )
        .route(
            "/api/v1/docker/containers",
            get(containers::list_all_containers).post(containers::run_container),
        )
        .route(
            "/api/v1/docker/containers/{id}",
            put(containers::update_container),
        )
        .route(
            "/api/v1/docker/containers/{id}/recreate",
            post(containers::recreate_container),
        )
        .route(
            "/api/v1/docker/containers/{id}/action",
            post(containers::container_action),
        )
        .route(
            "/api/v1/docker/containers/{id}/logs",
            get(containers::container_logs),
        )
        .route(
            "/api/v1/docker/containers/{id}/inspect",
            get(containers::container_inspect),
        )
        .route("/api/v1/docker/images", get(images::list_all_images))
        .route("/api/v1/docker/images/pull", post(images::pull_image))
        .route("/api/v1/docker/images/{id}", delete(images::remove_image))
        .route("/api/v1/docker/prune", post(containers::system_prune))
}
