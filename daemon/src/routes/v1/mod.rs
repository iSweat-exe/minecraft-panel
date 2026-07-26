pub mod auth;
pub mod automations;
pub mod discovery;
pub mod docker;
pub mod history;
pub mod node;
pub mod servers;
pub mod sessions;
pub mod users;

use crate::routes::AppState;
use axum::Router;

pub fn router() -> Router<AppState> {
    Router::new()
        .merge(auth::router())
        .merge(automations::router())
        .merge(discovery::router())
        .merge(docker::router())
        .merge(history::router())
        .merge(node::router())
        .merge(servers::router())
        .merge(sessions::router())
        .merge(users::router())
}
