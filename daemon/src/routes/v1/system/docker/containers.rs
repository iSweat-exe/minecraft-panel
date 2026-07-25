use axum::{
    extract::{Path, State},
    Json,
};
use protocol::{
    ApiResponse, DockerContainerInfo, DockerRunRequest, DockerUpdateRequest,
};

use crate::{auth::UserAuth, AppState};

pub async fn list_all_containers(
    auth: UserAuth,
    State(state): State<AppState>,
) -> Json<ApiResponse<Vec<DockerContainerInfo>>> {
    if let Err(e) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
    }
    match state.docker.list_all_containers().await {
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
    if let Err(e) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
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
    if let Err(e) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
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
    if let Err(e) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
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
    if let Err(e) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
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

pub async fn run_container(
    auth: UserAuth,
    State(state): State<AppState>,
    Json(payload): Json<DockerRunRequest>,
) -> Json<ApiResponse<String>> {
    if let Err(e) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
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
    if let Err(e) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
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
    if let Err(e) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
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
