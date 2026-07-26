use crate::routes::AppState;
use crate::services::auth::NodeAuth;
use axum::{routing::get, Json, Router};
use serde_json::{json, Value};
use sysinfo::System;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1", get(get_api_endpoints))
        .route("/api/v1/metadata", get(get_metadata))
}

/// Retourne la liste de tous les endpoints disponibles dans l'API v1
#[utoipa::path(
    summary = "Get Api Endpoints",
    get,
    path = "/api/v1",
    responses(
        (status = 200, description = "List all API endpoints", body = inline(Value))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn get_api_endpoints(_auth: NodeAuth) -> Json<Value> {
    Json(json!({
        "version": "v1",
        "description": "VPS Panel Daemon API",
        "endpoints": {
            "discovery": [
                "GET /api/v1",
                "GET /api/v1/metadata"
            ],
            "node": [
                "GET /api/v1/node/metrics",
                "POST /api/v1/node/update",
                "GET /api/v1/node/allocations",
                "GET /api/v1/node/crontab",
                "PUT /api/v1/node/crontab",
                "GET /api/v1/node/memory",
                "GET /api/v1/node/host",
                "POST /api/v1/node/host/exec",
                "GET /api/v1/node/host/pty",
                "GET /api/v1/node/health",
                "GET /api/v1/node/logs",
                "GET /api/v1/node/info"
            ],
            "servers": [
                "GET /api/v1/servers",
                "POST /api/v1/servers",
                "PATCH /api/v1/servers/{server_id}",
                "DELETE /api/v1/servers/{server_id}",
                "POST /api/v1/servers/{server_id}/power",
                "POST /api/v1/servers/{server_id}/command",
                "POST /api/v1/servers/{server_id}/rcon",
                "GET /api/v1/servers/{server_id}/inspect",
                "GET /api/v1/servers/{server_id}/console",
                "GET /api/v1/servers/{server_id}/crashes",
                "GET /api/v1/servers/{server_id}/logs",
                "GET /api/v1/servers/{server_id}/backups",
                "POST /api/v1/servers/{server_id}/backups",
                "DELETE /api/v1/servers/{server_id}/backups/{backup_name}",
                "GET /api/v1/servers/{server_id}/metrics/history"
            ],
            "files": [
                "GET /api/v1/servers/{server_id}/files/list",
                "GET /api/v1/servers/{server_id}/files/read",
                "POST /api/v1/servers/{server_id}/files/write",
                "POST /api/v1/servers/{server_id}/files/upload",
                "GET /api/v1/servers/{server_id}/files/download",
                "POST /api/v1/servers/{server_id}/files/action",
                "GET /api/v1/servers/{server_id}/files/hash",
                "POST /api/v1/servers/{server_id}/files/hash_multiple"
            ],
            "users_and_auth": [
                "GET /api/v1/users",
                "POST /api/v1/users",
                "DELETE /api/v1/users/{username}",
                "POST /api/v1/auth/login"
            ],
            "sessions": [
                "GET /api/v1/sessions",
                "POST /api/v1/sessions",
                "DELETE /api/v1/sessions/{id}"
            ],
            "history": [
                "GET /api/v1/history",
                "POST /api/v1/history"
            ],
            "automations": [
                "GET /api/v1/automations",
                "POST /api/v1/automations",
                "DELETE /api/v1/automations/{id}"
            ],
            "docker_global": [
                "GET /api/v1/docker/config",
                "PUT /api/v1/docker/config",
                "GET /api/v1/docker/containers",
                "POST /api/v1/docker/containers",
                "PUT /api/v1/docker/containers/{id}",
                "POST /api/v1/docker/containers/{id}/recreate",
                "POST /api/v1/docker/containers/{id}/action",
                "GET /api/v1/docker/containers/{id}/logs",
                "GET /api/v1/docker/containers/{id}/inspect",
                "GET /api/v1/docker/images",
                "POST /api/v1/docker/images/pull",
                "DELETE /api/v1/docker/images/{id}",
                "POST /api/v1/docker/prune"
            ]
        }
    }))
}

/// Retourne des métadonnées sur le daemon et les capacités du système
#[utoipa::path(
    summary = "Get Metadata",
    get,
    path = "/api/v1/metadata",
    responses(
        (status = 200, description = "Get daemon metadata", body = inline(Value))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn get_metadata(
    _auth: NodeAuth,
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Json<Value> {
    let os_name = System::name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = System::os_version().unwrap_or_else(|| "Unknown".to_string());
    let kernel_version = System::kernel_version().unwrap_or_else(|| "Unknown".to_string());
    let cpu_arch = std::env::consts::ARCH;

    // Check dynamic capabilities
    let docker_connected = state.docker.docker_client().ping().await.is_ok();
    let cron_enabled = state.scheduler.is_some();

    Json(json!({
        "api": {
            "version": "v1",
            "author": "iSweat (alias Cypress)",
            "description": "VPS Panel Daemon API",
            "github": "https://github.com/isweat-exe/vps-panel/",
            "website": "https://isweat.pro/",
            "deprecated": false,
        },
        "daemon": {
            "name": "vps-panel-daemon",
            "version": env!("CARGO_PKG_VERSION"),
            "rust_version": env!("RUSTC_VERSION")
        },
        "host": {
            "os_name": os_name,
            "os_version": os_version,
            "kernel_version": kernel_version,
            "architecture": cpu_arch
        },
        "capabilities": {
            "docker_management": docker_connected,
            "file_management": true,
            "host_pty": true,
            "metrics_monitoring": true,
            "cron_scheduling": cron_enabled
        }
    }))
}
