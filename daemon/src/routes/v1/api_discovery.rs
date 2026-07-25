use axum::{routing::get, Json, Router};
use serde_json::{json, Value};
use crate::auth::NodeAuth;
use crate::routes::AppState;
use sysinfo::System;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1", get(get_api_endpoints))
        .route("/api/v1/metadata", get(get_metadata))
}

/// Retourne la liste de tous les endpoints disponibles dans l'API v1
async fn get_api_endpoints(_auth: NodeAuth) -> Json<Value> {
    Json(json!({
        "version": "v1",
        "description": "VPS Panel Daemon API",
        "endpoints": {
            "discovery": [
                "GET /api/v1",
                "GET /api/v1/metadata",
                "GET /api/v1/info"
            ],
            "system": [
                "GET /api/v1/metrics",
                "POST /api/v1/update",
                "GET /api/v1/system/allocations",
                "GET /api/v1/system/backups/{server_id}",
                "POST /api/v1/system/backups/{server_id}",
                "GET /api/v1/system/crontab",
                "PUT /api/v1/system/crontab",
                "GET /api/v1/system/docker-config",
                "PUT /api/v1/system/docker-config",
                "GET /api/v1/system/memory",
                "GET /api/v1/system/host",
                "POST /api/v1/system/host/exec",
                "GET /api/v1/system/host/pty",
                "GET /api/v1/system/health",
                "GET /api/v1/system/logs"
            ],
            "containers": [
                "GET /api/v1/containers",
                "POST /api/v1/containers",
                "PATCH /api/v1/containers/{server_id}",
                "DELETE /api/v1/containers/{server_id}",
                "POST /api/v1/containers/{server_id}/power",
                "POST /api/v1/containers/{server_id}/command",
                "POST /api/v1/containers/{server_id}/rcon_multi",
                "GET /api/v1/containers/{server_id}/inspect",
                "GET /api/v1/containers/{server_id}/ws",
                "GET /api/v1/containers/{server_id}/crashes",
                "GET /api/v1/containers/{server_id}/logs"
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
                "GET /api/v1/system/docker/containers",
                "POST /api/v1/system/docker/containers",
                "PUT /api/v1/system/docker/containers/{id}",
                "POST /api/v1/system/docker/containers/{id}/recreate",
                "POST /api/v1/system/docker/containers/{id}/action",
                "GET /api/v1/system/docker/containers/{id}/logs",
                "GET /api/v1/system/docker/containers/{id}/inspect",
                "GET /api/v1/system/docker/images",
                "POST /api/v1/system/docker/images/pull",
                "DELETE /api/v1/system/docker/images/{id}",
                "POST /api/v1/system/docker/prune"
            ]
        }
    }))
}

/// Retourne des métadonnées sur le daemon et les capacités du système
async fn get_metadata(_auth: NodeAuth, axum::extract::State(state): axum::extract::State<AppState>) -> Json<Value> {
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
