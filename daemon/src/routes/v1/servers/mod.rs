pub mod backups;
pub mod command;
pub mod stream;
pub mod crashes;
pub mod create;
pub mod delete;
pub mod files;
pub mod inspect;
pub mod list;
pub mod logs;
pub mod patch;
pub mod power;
pub mod tasks;

pub mod metrics;

use crate::routes::AppState;
use axum::routing::{get, post};
use axum::Router;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/v1/servers",
            get(list::list_servers).post(create::create_server),
        )
        .route(
            "/api/v1/servers/{server_id}",
            get(list::get_server)
                .patch(patch::patch_server)
                .delete(delete::delete_server),
        )
        .route(
            "/api/v1/servers/{server_id}/power",
            post(power::server_power),
        )
        .route(
            "/api/v1/servers/{server_id}/command",
            post(command::server_command),
        )
        .route(
            "/api/v1/servers/{server_id}/rcon",
            post(command::server_rcon_multi),
        )
        .route(
            "/api/v1/servers/{server_id}/inspect",
            get(inspect::server_inspect),
        )
        .route(
            "/api/v1/servers/{server_id}/stream",
            get(stream::ws_stream_handler),
        )
        .route(
            "/api/v1/servers/{server_id}/crashes",
            get(crashes::server_crashes),
        )
        .route("/api/v1/servers/{server_id}/logs", get(logs::server_logs))
        .route(
            "/api/v1/servers/{server_id}/backups",
            get(backups::list_backups).post(backups::create_backup),
        )
        .route(
            "/api/v1/servers/{server_id}/backups/{backup_name}",
            axum::routing::delete(backups::delete_backup),
        )
        .route(
            "/api/v1/servers/{server_id}/backups/{backup_name}/restore",
            post(backups::restore_backup),
        )
        .route(
            "/api/v1/servers/{server_id}/backups/{backup_name}/download",
            get(backups::download_backup),
        )
        .route(
            "/api/v1/servers/{server_id}/metrics/history",
            get(metrics::server_metrics_history),
        )
        .route(
            "/api/v1/servers/{server_id}/tasks/{task_id}/stream",
            get(tasks::stream_task),
        )
        .merge(files::router())
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
            "SELECT server_id FROM server_allocations WHERE host_ip = ? AND host_port = ?",
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
                "INSERT INTO server_allocations (server_id, host_ip, host_port) VALUES (?, ?, ?)",
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
