use anyhow::{Context, Result};
use axum::{extract::{Path, State}, Json};
use protocol::{
    ApiResponse, DockerConfigUpdateRequest, DockerContainerInfo, DockerImageInfo,
    DockerRunRequest, DockerUpdateRequest
};
use std::process::Command as StdCommand;

use crate::{auth::NodeAuth, AppState};

pub async fn list_all_containers(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Json<ApiResponse<Vec<DockerContainerInfo>>> {
    match state.docker.list_all_containers().await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn list_all_images(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Json<ApiResponse<Vec<DockerImageInfo>>> {
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
    _auth: NodeAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<DockerActionPayload>,
) -> Json<ApiResponse<String>> {
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

pub async fn container_logs(
    _auth: NodeAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Json<ApiResponse<String>> {
    match state.docker.run_docker_command(&["logs", "--tail", "150", &id]).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn container_inspect(
    _auth: NodeAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Json<ApiResponse<String>> {
    match state.docker.run_docker_command(&["inspect", &id]).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn system_prune(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Json<ApiResponse<String>> {
    match state.docker.run_docker_command(&["system", "prune", "-af", "--volumes"]).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

#[derive(serde::Deserialize)]
pub struct PullImagePayload {
    pub image_name: String,
}

pub async fn pull_image(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Json(payload): Json<PullImagePayload>,
) -> Json<ApiResponse<String>> {
    match state.docker.run_docker_command(&["pull", &payload.image_name]).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn remove_image(
    _auth: NodeAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Json<ApiResponse<String>> {
    match state.docker.run_docker_command(&["rmi", "-f", &id]).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn run_container(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Json(payload): Json<DockerRunRequest>,
) -> Json<ApiResponse<String>> {
    let mut args = vec!["run", "-d", "--security-opt", "seccomp=unconfined", "--security-opt", "apparmor=unconfined"];
    
    if let Some(name) = &payload.name {
        let clean = name.trim();
        if !clean.is_empty() {
            args.push("--name");
            args.push(clean);
        }
    }
    
    if let Some(policy) = &payload.restart_policy {
        let clean = policy.trim();
        if !clean.is_empty() {
            args.push("--restart");
            args.push(clean);
        }
    }
    
    let mut port_args = Vec::new();
    if let Some(ports) = &payload.ports {
        for p in ports.split(',') {
            let clean = p.trim();
            if !clean.is_empty() {
                port_args.push(clean.to_string());
            }
        }
    }
    for p in &port_args {
        args.push("-p");
        args.push(p);
    }
    
    let mut env_args = Vec::new();
    if let Some(envs) = &payload.env_vars {
        for e in envs {
            let clean = e.trim();
            if !clean.is_empty() {
                env_args.push(clean.to_string());
            }
        }
    }
    for e in &env_args {
        args.push("-e");
        args.push(e);
    }
    
    args.push(&payload.image);
    
    match state.docker.run_docker_command(&args).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn update_container(
    _auth: NodeAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<DockerUpdateRequest>,
) -> Json<ApiResponse<String>> {
    if let Some(policy) = &payload.restart_policy {
        let clean = policy.trim();
        if !clean.is_empty() {
            let _ = state.docker.run_docker_command(&["update", "--restart", clean, &id]).await;
        }
    }
    
    if let Some(name) = &payload.new_name {
        let clean = name.trim();
        if !clean.is_empty() {
            let _ = state.docker.run_docker_command(&["rename", &id, clean]).await;
        }
    }
    
    match state.docker.run_docker_command(&["restart", "-t", "10", &id]).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn recreate_container(
    _auth: NodeAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<DockerRunRequest>,
) -> Json<ApiResponse<String>> {
    let _ = state.docker.run_docker_command(&["rm", "-f", &id]).await;
    
    let mut args = vec!["run", "-d", "--security-opt", "seccomp=unconfined", "--security-opt", "apparmor=unconfined"];
    
    if let Some(name) = &payload.name {
        let clean = name.trim();
        if !clean.is_empty() {
            args.push("--name");
            args.push(clean);
        }
    }
    
    if let Some(policy) = &payload.restart_policy {
        let clean = policy.trim();
        if !clean.is_empty() {
            args.push("--restart");
            args.push(clean);
        }
    }
    
    let mut port_args = Vec::new();
    if let Some(ports) = &payload.ports {
        for p in ports.split(',') {
            let clean = p.trim();
            if !clean.is_empty() {
                port_args.push(clean.to_string());
            }
        }
    }
    for p in &port_args {
        args.push("-p");
        args.push(p);
    }
    
    let mut env_args = Vec::new();
    if let Some(envs) = &payload.env_vars {
        for e in envs {
            let clean = e.trim();
            if !clean.is_empty() {
                env_args.push(clean.to_string());
            }
        }
    }
    for e in &env_args {
        args.push("-e");
        args.push(e);
    }
    
    args.push(&payload.image);
    
    match state.docker.run_docker_command(&args).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn get_docker_config(_auth: NodeAuth) -> Json<ApiResponse<serde_json::Value>> {
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
    _auth: NodeAuth,
    Json(payload): Json<DockerConfigUpdateRequest>,
) -> Json<ApiResponse<String>> {
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
    let output = StdCommand::new("systemctl")
        .arg("reload")
        .arg("docker")
        .output()
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
