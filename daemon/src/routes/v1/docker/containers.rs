use axum::{
    extract::{Path, State},
    Json,
};
use protocol::{DockerContainerInfo, DockerRunRequest, DockerUpdateRequest};

use crate::{services::auth::UserAuth, AppState};

#[utoipa::path(
    tag = "Docker",
    summary = "Retrieve a list of all Docker containers on the node",
    get,
    path = "/api/v1/docker/containers",
    responses(
        (status = 200, description = "List all docker containers", body = inline(Vec<DockerContainerInfo>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn list_all_containers(
    auth: UserAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<DockerContainerInfo>>, crate::error::DaemonError> {
    if let Err(e) = auth.require_permission("system:docker") {
        return Err(crate::error::DaemonError::BadRequest(e.to_string()));
    }
    match state.docker.list_all_containers().await {
        Ok(v) => Ok(Json(v)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
pub struct DockerActionPayload {
    pub action: String,
}

#[utoipa::path(
    tag = "Docker",
    summary = "Perform an action (start, stop, restart, kill) on a container",
    post,
    path = "/api/v1/docker/containers/{id}/action",
    params(
        ("id" = String, Path, description = "Container ID")
    ),
    request_body = DockerActionPayload,
    responses(
        (status = 200, description = "Perform action on container", body = inline(String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn container_action(
    auth: UserAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<DockerActionPayload>,
) -> Result<Json<String>, crate::error::DaemonError> {
    if let Err(e) = auth.require_permission("system:docker") {
        return Err(crate::error::DaemonError::BadRequest(e.to_string()));
    }
    let cmd = match payload.action.as_str() {
        "start" => vec!["start", &id],
        "stop" => vec!["stop", "-t", "10", &id],
        "restart" => vec!["restart", "-t", "10", &id],
        "remove" => vec!["rm", "-f", &id],
        _ => return Err(crate::error::DaemonError::BadRequest("Action non reconnue".to_string())),
    };

    match state.docker.run_docker_command(&cmd).await {
        Ok(v) => Ok(Json(v)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
pub struct ContainerLogsQuery {
    #[serde(default = "default_tail")]
    pub tail: u32,
}

fn default_tail() -> u32 {
    150
}

#[utoipa::path(
    tag = "Docker",
    summary = "Retrieve the standard output and error logs of a container",
    get,
    path = "/api/v1/docker/containers/{id}/logs",
    params(
        ("id" = String, Path, description = "Container ID"),
        ("tail" = Option<u32>, Query, description = "Number of lines to tail")
    ),
    responses(
        (status = 200, description = "Get container logs", body = inline(String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn container_logs(
    auth: UserAuth,
    Path(id): Path<String>,
    axum::extract::Query(query): axum::extract::Query<ContainerLogsQuery>,
    State(state): State<AppState>,
) -> Result<Json<String>, crate::error::DaemonError> {
    if let Err(e) = auth.require_permission("system:docker") {
        return Err(crate::error::DaemonError::BadRequest(e.to_string()));
    }
    let tail_str = query.tail.to_string();
    match state
        .docker
        .run_docker_command(&["logs", "--tail", &tail_str, &id])
        .await
    {
        Ok(v) => Ok(Json(v)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}

#[utoipa::path(
    tag = "Docker",
    summary = "Retrieve detailed low-level information about a container",
    get,
    path = "/api/v1/docker/containers/{id}/inspect",
    params(
        ("id" = String, Path, description = "Container ID")
    ),
    responses(
        (status = 200, description = "Inspect container", body = inline(String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn container_inspect(
    auth: UserAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<String>, crate::error::DaemonError> {
    if let Err(e) = auth.require_permission("system:docker") {
        return Err(crate::error::DaemonError::BadRequest(e.to_string()));
    }
    match state.docker.run_docker_command(&["inspect", &id]).await {
        Ok(v) => Ok(Json(v)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}

#[derive(serde::Deserialize, Default, utoipa::ToSchema)]
pub struct SystemPrunePayload {
    #[serde(default)]
    pub include_volumes: bool,
}

#[utoipa::path(
    tag = "Docker",
    summary = "Remove unused Docker data (containers, networks, images, volumes)",
    post,
    path = "/api/v1/docker/prune",
    request_body(content = Option<SystemPrunePayload>),
    responses(
        (status = 200, description = "System prune", body = inline(String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn system_prune(
    auth: UserAuth,
    State(state): State<AppState>,
    body: Option<Json<SystemPrunePayload>>,
) -> Result<Json<String>, crate::error::DaemonError> {
    if let Err(e) = auth.require_permission("system:docker") {
        return Err(crate::error::DaemonError::BadRequest(e.to_string()));
    }
    let include_volumes = body.is_some_and(|b| b.0.include_volumes);
    let mut cmd = vec!["system", "prune", "-af"];
    if include_volumes {
        cmd.push("--volumes");
    }
    match state.docker.run_docker_command(&cmd).await {
        Ok(v) => Ok(Json(v)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}

#[utoipa::path(
    tag = "Docker",
    summary = "Create and start a new Docker container",
    post,
    path = "/api/v1/docker/containers",
    request_body = DockerRunRequest,
    responses(
        (status = 200, description = "Run a new container", body = inline(String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn run_container(
    auth: UserAuth,
    State(state): State<AppState>,
    Json(payload): Json<DockerRunRequest>,
) -> Result<Json<String>, crate::error::DaemonError> {
    if let Err(e) = auth.require_permission("system:docker") {
        return Err(crate::error::DaemonError::BadRequest(e.to_string()));
    }
    let args = build_docker_run_args(&payload);
    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    match state.docker.run_docker_command(&str_args).await {
        Ok(v) => Ok(Json(v)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}

#[utoipa::path(
    tag = "Docker",
    summary = "Update the configuration of an existing Docker container",
    put,
    path = "/api/v1/docker/containers/{id}",
    params(
        ("id" = String, Path, description = "Container ID")
    ),
    request_body = DockerUpdateRequest,
    responses(
        (status = 200, description = "Update a container", body = inline(String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn update_container(
    auth: UserAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<DockerUpdateRequest>,
) -> Result<Json<String>, crate::error::DaemonError> {
    if let Err(e) = auth.require_permission("system:docker") {
        return Err(crate::error::DaemonError::BadRequest(e.to_string()));
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
            return Err(crate::error::DaemonError::BadRequest(format!("docker update failed: {:#}", e)));
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
                return Err(crate::error::DaemonError::BadRequest(format!("docker rename failed: {:#}", e)));
            }
        }
    }

    if needs_restart {
        match state
            .docker
            .run_docker_command(&["restart", "-t", "10", &id])
            .await
        {
            Ok(v) => Ok(Json(v)),
            Err(e) => Err(crate::error::DaemonError::BadRequest(format!("docker restart failed: {:#}", e))),
        }
    } else {
        Ok(Json("Container updated".to_string()))
    }
}

#[utoipa::path(
    tag = "Docker",
    summary = "Recreate a Docker container with updated configuration or image",
    post,
    path = "/api/v1/docker/containers/{id}/recreate",
    params(
        ("id" = String, Path, description = "Container ID")
    ),
    request_body = DockerRunRequest,
    responses(
        (status = 200, description = "Recreate a container", body = inline(String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn recreate_container(
    auth: UserAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<DockerRunRequest>,
) -> Result<Json<String>, crate::error::DaemonError> {
    if let Err(e) = auth.require_permission("system:docker") {
        return Err(crate::error::DaemonError::BadRequest(e.to_string()));
    }
    if let Err(e) = state.docker.run_docker_command(&["rm", "-f", &id]).await {
        return Err(crate::error::DaemonError::BadRequest(format!(
            "Failed to remove old container: {:#}",
            e
        )));
    }

    let args = build_docker_run_args(&payload);
    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    match state.docker.run_docker_command(&str_args).await {
        Ok(v) => Ok(Json(v)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
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
