pub mod files;
pub mod servers;
pub mod system;

use crate::config::DaemonConfig;
use crate::docker::DockerManager;
use axum::Router;

#[derive(Clone)]
pub struct AppState {
    pub config: DaemonConfig,
    pub docker: DockerManager,
    pub start_time: std::time::Instant,
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .merge(system::router())
        .merge(files::router())
        .merge(servers::router())
        .layer(axum::Extension(state.config.clone()))
        .with_state(state)
}
