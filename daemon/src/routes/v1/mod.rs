pub mod automations;
pub mod files;
pub mod history;
pub mod containers;
pub mod sessions;
pub mod system;
pub mod users;
pub mod auth_routes;

use axum::Router;
use crate::routes::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .merge(system::router())
        .merge(files::router())
        .merge(containers::router())
        .merge(users::router())
        .merge(sessions::router())
        .merge(history::router())
        .merge(automations::router())
        .merge(auth_routes::router())
}
