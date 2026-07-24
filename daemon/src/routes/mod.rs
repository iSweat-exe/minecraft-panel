pub mod automations;
pub mod files;
pub mod history;
pub mod servers;
pub mod sessions;
pub mod system;
pub mod users;

use crate::config::DaemonConfig;
use crate::docker::DockerManager;
use axum::Router;

#[derive(Clone)]
pub struct AppState {
    pub config: DaemonConfig,
    pub docker: DockerManager,
    pub start_time: std::time::Instant,
    pub db: sqlx::SqlitePool,
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .merge(system::router())
        .merge(files::router())
        .merge(servers::router())
        .merge(users::router())
        .merge(sessions::router())
        .merge(history::router())
        .merge(automations::router())
        .layer(axum::Extension(state.config.clone()))
        .with_state(state)
}
