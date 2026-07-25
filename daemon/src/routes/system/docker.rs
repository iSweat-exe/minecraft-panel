use anyhow::{Context, Result};
use axum::{
    extract::{Path, State},
    Json,
};
use protocol::{
    ApiResponse, DockerConfigUpdateRequest, DockerContainerInfo, DockerImageInfo, DockerRunRequest,
    DockerUpdateRequest,
};
use tokio::process::Command as TokioCommand;

use crate::{auth::UserAuth, AppState};

pub async fn list_all_containers(
    auth: UserAuth,
    State(state): State<AppState>,
) -> Json<ApiResponse<Vec<DockerContainerInfo>>> {
    if let Err((_, msg)) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    match state.docker.list_all_containers().await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn list_all_images(
    auth: UserAuth,
    State(state): State<AppState>,
) -> Json<ApiResponse<Vec<DockerImageInfo>>> {
    if let Err((_, msg)) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    match state.docker.list_all_images().await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

#[derive(serde::Deserialize)]
pub struct DockerActionPayload {
    pub action: String,
}

pub async fn container_action(
    auth: UserAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<DockerActionPayload>,
) -> Json<ApiResponse<String>> {
    if let Err((_, msg)) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    let cmd = match payload.action.as_str() {
        "start" => vec!["start", &id],
        "stop" => vec!["stop", "-t", "10", &id],
        "restart" => vec!["restart", "-t", "10", &id],
        "remove" => vec!["rm", "-f", &id],
        _ => return Json(ApiResponse::err("Action non reconnue")),
    };

    match state.docker.run_docker_command(&cmd).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

#[derive(serde::Deserialize)]
pub struct ContainerLogsQuery {
    #[serde(default = "default_tail")]
    pub tail: u32,
}

fn default_tail() -> u32 {
    150
}

pub async fn container_logs(
    auth: UserAuth,
    Path(id): Path<String>,
    axum::extract::Query(query): axum::extract::Query<ContainerLogsQuery>,
    State(state): State<AppState>,
) -> Json<ApiResponse<String>> {
    if let Err((_, msg)) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    let tail_str = query.tail.to_string();
    match state
        .docker
        .run_docker_command(&["logs", "--tail", &tail_str, &id])
        .await
    {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn container_inspect(
    auth: UserAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Json<ApiResponse<String>> {
    if let Err((_, msg)) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    match state.docker.run_docker_command(&["inspect", &id]).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

#[derive(serde::Deserialize, Default)]
pub struct SystemPrunePayload {
    #[serde(default)]
    pub include_volumes: bool,
}

pub async fn system_prune(
    auth: UserAuth,
    State(state): State<AppState>,
    body: Option<Json<SystemPrunePayload>>,
) -> Json<ApiResponse<String>> {
    if let Err((_, msg)) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    let include_volumes = body.map_or(false, |b| b.0.include_volumes);
    let mut cmd = vec!["system", "prune", "-af"];
    if include_volumes {
        cmd.push("--volumes");
    }
    match state.docker.run_docker_command(&cmd).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

#[derive(serde::Deserialize)]
pub struct PullImagePayload {
    pub image_name: String,
}

pub async fn pull_image(
    auth: UserAuth,
    State(state): State<AppState>,
    Json(payload): Json<PullImagePayload>,
) -> Json<ApiResponse<String>> {
    if let Err((_, msg)) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    match state
        .docker
        .run_docker_command(&["pull", &payload.image_name])
        .await
    {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn remove_image(
    auth: UserAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Json<ApiResponse<String>> {
    if let Err((_, msg)) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    match state.docker.run_docker_command(&["rmi", "-f", &id]).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn run_container(
    auth: UserAuth,
    State(state): State<AppState>,
    Json(payload): Json<DockerRunRequest>,
) -> Json<ApiResponse<String>> {
    if let Err((_, msg)) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    let args = build_docker_run_args(&payload);
    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    match state.docker.run_docker_command(&str_args).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn update_container(
    auth: UserAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<DockerUpdateRequest>,
) -> Json<ApiResponse<String>> {
    if let Err((_, msg)) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    let mut update_args = vec!["update"];

    if let Some(policy) = &payload.restart_policy {
        let clean = policy.trim();
        if !clean.is_empty() {
            update_args.push("--restart");
            update_args.push(clean);
        }
    }

    if let Some(memory) = &payload.memory {
        let clean = memory.trim();
        if !clean.is_empty() {
            update_args.push("--memory");
            update_args.push(clean);
        }
    }

    if let Some(swap) = &payload.memory_swap {
        let clean = swap.trim();
        if !clean.is_empty() {
            update_args.push("--memory-swap");
            update_args.push(clean);
        }
    }

    let needs_restart = update_args.len() > 1;

    if needs_restart {
        update_args.push(&id);
        if let Err(e) = state.docker.run_docker_command(&update_args).await {
            return Json(ApiResponse::err(format!("docker update failed: {:#}", e)));
        }
    }

    if let Some(name) = &payload.new_name {
        let clean = name.trim();
        if !clean.is_empty() {
            if let Err(e) = state
                .docker
                .run_docker_command(&["rename", &id, clean])
                .await
            {
                return Json(ApiResponse::err(format!("docker rename failed: {:#}", e)));
            }
        }
    }

    if needs_restart {
        match state
            .docker
            .run_docker_command(&["restart", "-t", "10", &id])
            .await
        {
            Ok(v) => Json(ApiResponse::ok(v)),
            Err(e) => Json(ApiResponse::err(format!("docker restart failed: {:#}", e))),
        }
    } else {
        Json(ApiResponse::ok("Container updated".to_string()))
    }
}

pub async fn recreate_container(
    auth: UserAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<DockerRunRequest>,
) -> Json<ApiResponse<String>> {
    if let Err((_, msg)) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    if let Err(e) = state.docker.run_docker_command(&["rm", "-f", &id]).await {
        return Json(ApiResponse::err(format!(
            "Failed to remove old container: {:#}",
            e
        )));
    }

    let args = build_docker_run_args(&payload);
    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    match state.docker.run_docker_command(&str_args).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn get_docker_config(auth: UserAuth) -> Json<ApiResponse<serde_json::Value>> {
    if let Err((_, msg)) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
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

pub async fn update_docker_config(
    auth: UserAuth,
    Json(payload): Json<DockerConfigUpdateRequest>,
) -> Json<ApiResponse<String>> {
    if let Err((_, msg)) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    match update_docker_config_impl(payload.config)
        .await
        .context("Failed to update Docker configuration")
    {
        Ok(s) => Json(ApiResponse::ok(s)),
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

fn build_docker_run_args(payload: &DockerRunRequest) -> Vec<String> {
    let mut args = vec!["run".to_string(), "-d".to_string()];

    if payload.disable_security_opts {
        args.extend([
            "--security-opt".to_string(),
            "seccomp=unconfined".to_string(),
            "--security-opt".to_string(),
            "apparmor=unconfined".to_string(),
        ]);
    }

    if let Some(name) = &payload.name {
        let clean = name.trim();
        if !clean.is_empty() {
            args.push("--name".to_string());
            args.push(clean.to_string());
        }
    }

    if let Some(policy) = &payload.restart_policy {
        let clean = policy.trim();
        if !clean.is_empty() {
            args.push("--restart".to_string());
            args.push(clean.to_string());
        }
    }

    if let Some(ports) = &payload.ports {
        for p in ports.split(",") {
            let clean = p.trim();
            if !clean.is_empty() {
                args.push("-p".to_string());
                args.push(clean.to_string());
            }
        }
    }

    if let Some(envs) = &payload.env_vars {
        for e in envs {
            let clean = e.trim();
            if !clean.is_empty() {
                args.push("-e".to_string());
                args.push(clean.to_string());
            }
        }
    }

    args.push(payload.image.clone());
    args
}
