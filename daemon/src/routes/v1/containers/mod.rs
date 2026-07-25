
pub mod command;
pub mod crashes;
pub mod create;
pub mod delete;
pub mod inspect;
pub mod list;
pub mod logs;
pub mod power;
pub mod patch;
pub mod ws;

use crate::routes::AppState;
use axum::routing::{get, post, patch as patch_method};
use axum::Router;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/containers",
            get(list::list_servers).post(create::create_server),
        )
        .route("/api/v1/containers/{server_id}", patch_method(patch::patch_server).delete(delete::delete_server))
        .route("/api/v1/containers/{server_id}/power", post(power::server_power))
        .route(
            "/api/v1/containers/{server_id}/command",
            post(command::server_command),
        )
        .route(
            "/api/v1/containers/{server_id}/rcon_multi",
            post(command::server_rcon_multi),
        )
        .route("/api/v1/containers/{server_id}/inspect", get(inspect::server_inspect))
        .route("/api/v1/containers/{server_id}/ws", get(ws::ws_console_handler))
        .route("/api/v1/containers/{server_id}/crashes", get(crashes::server_crashes))
        .route("/api/v1/containers/{server_id}/logs", get(logs::server_logs))
}

pub async fn allocate_server_ports(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    server_id: &str,
    ports: &[protocol::docker::PortMapping],
) -> Result<(), crate::error::DaemonError> {
    for port_map in ports {
        let host_ip = "0.0.0.0";
        let host_port = port_map.host_port;

        let existing = sqlx::query_scalar::<_, String>(
            "SELECT server_id FROM server_allocations WHERE host_ip = ? AND host_port = ?"
        )
        .bind(host_ip)
        .bind(host_port)
        .fetch_optional(&mut **tx)
        .await?;

        if let Some(existing_server_id) = existing {
            if existing_server_id != server_id {
                return Err(crate::error::DaemonError::BadRequest(format!(
                    "Port {} is already in use by another server",
                    host_port
                )));
            }
        } else {
            sqlx::query(
                "INSERT INTO server_allocations (server_id, host_ip, host_port) VALUES (?, ?, ?)"
            )
            .bind(server_id)
            .bind(host_ip)
            .bind(host_port)
            .execute(&mut **tx)
            .await?;
        }
    }
    Ok(())
}
