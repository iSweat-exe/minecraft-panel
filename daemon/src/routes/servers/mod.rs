pub mod command;
pub mod crashes;
pub mod create;
pub mod delete;
pub mod inspect;
pub mod list;
pub mod logs;
pub mod ping;
pub mod power;
pub mod ws;

use crate::routes::AppState;
use axum::routing::{get, post};
use axum::Router;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/servers",
            get(list::list_servers).post(create::create_server),
        )
        .route("/api/v1/servers/{id}/power", post(power::server_power))
        .route(
            "/api/v1/servers/{id}/command",
            post(command::server_command),
        )
        .route("/api/v1/servers/{id}/rcon_multi", post(command::server_rcon_multi))
        .route("/api/v1/servers/{id}/inspect", get(inspect::server_inspect))
        .route(
            "/api/v1/servers/{id}",
            axum::routing::delete(delete::delete_server),
        )
        .route("/api/v1/servers/{id}/ws", get(ws::ws_console_handler))
        .route("/api/v1/servers/{id}/ping", get(ping::server_ping))
        .route("/api/v1/servers/{id}/crashes", get(crashes::server_crashes))
        .route("/api/v1/servers/{id}/logs", get(logs::server_logs))
}
