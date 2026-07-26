use anyhow::{Context, Result};
use axum::Json;
use protocol::{ApiResponse, DockerConfigUpdateRequest};
use tokio::process::Command as TokioCommand;

use crate::services::auth::UserAuth;

#[utoipa::path(
    get,
    path = "/api/v1/docker/config",
    responses(
        (status = 200, description = "Get Docker configuration", body = inline(ApiResponse<serde_json::Value>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_docker_config(auth: UserAuth) -> Json<ApiResponse<serde_json::Value>> {
    if let Err(e) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
    }
    match get_docker_config_impl()
        .await
        .context("Failed to read Docker configuration")
    {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

async fn get_docker_config_impl() -> Result<serde_json::Value> {
    let path = std::path::Path::new("/etc/docker/daemon.json");
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }

    let content = tokio::fs::read_to_string(path)
        .await
        .context("Could not read /etc/docker/daemon.json")?;
    let json =
        serde_json::from_str(&content).context("Invalid JSON format in /etc/docker/daemon.json")?;
    Ok(json)
}

#[utoipa::path(
    put,
    path = "/api/v1/docker/config",
    request_body = DockerConfigUpdateRequest,
    responses(
        (status = 200, description = "Update Docker configuration", body = inline(ApiResponse<String>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn update_docker_config(
    auth: UserAuth,
    Json(payload): Json<DockerConfigUpdateRequest>,
) -> Json<ApiResponse<String>> {
    if let Err(e) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
    }

    tracing::warn!(user = %auth.username, "Action sensible: modification de la configuration Docker");

    match update_docker_config_impl(payload.config)
        .await
        .context("Failed to update Docker configuration")
    {
        Ok(msg) => Json(ApiResponse::ok(msg)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

async fn update_docker_config_impl(new_config: serde_json::Value) -> Result<String> {
    let path = std::path::Path::new("/etc/docker/daemon.json");
    let mut config = if path.exists() {
        match tokio::fs::read_to_string(path).await {
            Ok(content) => serde_json::from_str(&content).unwrap_or(serde_json::json!({})),
            Err(_) => serde_json::json!({}),
        }
    } else {
        serde_json::json!({})
    };

    if let (Some(existing_obj), Some(new_obj)) = (config.as_object_mut(), new_config.as_object()) {
        for (k, v) in new_obj {
            existing_obj.insert(k.clone(), v.clone());
        }
    } else {
        config = new_config;
    }

    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }

    let json_str = serde_json::to_string_pretty(&config)
        .context("Failed to serialize merged Docker config")?;
    tokio::fs::write(path, json_str)
        .await
        .context("Failed to write to /etc/docker/daemon.json")?;

    // Reload docker daemon
    let output = TokioCommand::new("systemctl")
        .arg("reload")
        .arg("docker")
        .output()
        .await
        .context("Failed to spawn systemctl reload docker command")?;

    if output.status.success() {
        Ok("Docker configuration updated and reloaded".to_string())
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        if err_msg.contains("Failed to connect to bus") || err_msg.is_empty() {
            Ok("Config written, but could not reload docker (maybe not using systemd)".to_string())
        } else {
            anyhow::bail!("Config written, but systemctl reload failed: {}", err_msg)
        }
    }
}
