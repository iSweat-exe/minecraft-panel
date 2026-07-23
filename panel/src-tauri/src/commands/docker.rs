use crate::error::AppError;
use crate::state::SshState;
use crate::ssh::exec::run_exec;
use tauri::State;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DockerContainerInfo {
    pub id: String,
    pub names: String,
    pub image: String,
    pub status: String,
    pub state: String,
    pub ports: String,
    pub created: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DockerImageInfo {
    pub id: String,
    pub repository: String,
    pub tag: String,
    pub size: String,
    pub created: String,
}

#[tauri::command]
pub async fn docker_list_containers(state: State<'_, SshState>) -> Result<Vec<DockerContainerInfo>, AppError> {
    let script = r#"docker ps -a --format '{"id":"{{.ID}}","names":"{{.Names}}","image":"{{.Image}}","status":"{{.Status}}","state":"{{.State}}","ports":"{{.Ports}}","created":"{{.CreatedAt}}"}' 2>/dev/null"#;
    let output = run_exec(&state, script).await?;

    let mut containers = Vec::new();
    for line in output.lines() {
        let line_trimmed = line.trim();
        if line_trimmed.is_empty() {
            continue;
        }
        if let Ok(container) = serde_json::from_str::<DockerContainerInfo>(line_trimmed) {
            containers.push(container);
        }
    }

    Ok(containers)
}

#[tauri::command]
pub async fn docker_container_action(
    container_id: String,
    action: String,
    state: State<'_, SshState>
) -> Result<(), AppError> {
    let clean_id = container_id.trim();
    if clean_id.is_empty() {
        return Err(AppError::Message("ID de conteneur invalide".into()));
    }

    let cmd = match action.as_str() {
        "start" => format!("docker start {} 2>&1", clean_id),
        "stop" => format!("docker stop -t 10 {} 2>&1", clean_id),
        "restart" => format!("docker restart -t 10 {} 2>&1", clean_id),
        "remove" => format!("docker rm -f {} 2>&1", clean_id),
        _ => return Err(AppError::Message("Action non reconnue".into())),
    };

    let output = run_exec(&state, &cmd).await?;
    let lower = output.to_lowercase();
    if lower.contains("error:") || lower.contains("failed") || lower.contains("cannot") || lower.contains("permission denied") {
        return Err(AppError::Message(output.trim().to_string()));
    }
    Ok(())
}

#[tauri::command]
pub async fn docker_system_prune(state: State<'_, SshState>) -> Result<String, AppError> {
    let output = run_exec(&state, "docker system prune -af --volumes 2>&1").await?;
    Ok(output)
}

#[tauri::command]
pub async fn docker_container_logs(
    container_name: String,
    tail: Option<u32>,
    state: State<'_, SshState>
) -> Result<String, AppError> {
    let clean_name = container_name.trim();
    let num_lines = tail.unwrap_or(100);
    let cmd = format!("docker logs --tail {} {} 2>&1", num_lines, clean_name);
    let output = run_exec(&state, &cmd).await?;
    Ok(output)
}

#[tauri::command]
pub async fn docker_list_images(state: State<'_, SshState>) -> Result<Vec<DockerImageInfo>, AppError> {
    let script = r#"docker images --format '{"id":"{{.ID}}","repository":"{{.Repository}}","tag":"{{.Tag}}","size":"{{.Size}}","created":"{{.CreatedAt}}"}' 2>/dev/null"#;
    let output = run_exec(&state, script).await?;

    let mut images = Vec::new();
    for line in output.lines() {
        let line_trimmed = line.trim();
        if line_trimmed.is_empty() {
            continue;
        }
        if let Ok(img) = serde_json::from_str::<DockerImageInfo>(line_trimmed) {
            images.push(img);
        }
    }

    Ok(images)
}

#[tauri::command]
pub async fn docker_pull_image(image_name: String, state: State<'_, SshState>) -> Result<String, AppError> {
    let clean = image_name.trim();
    if clean.is_empty() {
        return Err(AppError::Message("Nom d'image invalide".into()));
    }
    let cmd = format!("docker pull {} 2>&1", clean);
    let output = run_exec(&state, &cmd).await?;
    Ok(output)
}

#[tauri::command]
pub async fn docker_remove_image(image_id: String, state: State<'_, SshState>) -> Result<String, AppError> {
    let clean = image_id.trim();
    if clean.is_empty() {
        return Err(AppError::Message("ID d'image invalide".into()));
    }
    let cmd = format!("docker rmi -f {} 2>&1", clean);
    let output = run_exec(&state, &cmd).await?;
    Ok(output)
}

#[tauri::command]
pub async fn docker_run_container(
    image: String,
    name: Option<String>,
    ports: Option<String>,
    env_vars: Option<Vec<String>>,
    restart_policy: Option<String>,
    state: State<'_, SshState>
) -> Result<String, AppError> {
    let clean_image = image.trim();
    if clean_image.is_empty() {
        return Err(AppError::Message("Nom d'image requis".into()));
    }

    let mut cmd = String::from("docker run -d --security-opt seccomp=unconfined --security-opt apparmor=unconfined");
    if let Some(n) = name {
        let clean_n = n.trim();
        if !clean_n.is_empty() {
            cmd.push_str(&format!(" --name {}", clean_n));
        }
    }
    if let Some(policy) = restart_policy {
        let clean_p = policy.trim();
        if !clean_p.is_empty() {
            cmd.push_str(&format!(" --restart {}", clean_p));
        }
    }
    if let Some(p) = ports {
        for port_pair in p.split(',') {
            let trimmed = port_pair.trim();
            if !trimmed.is_empty() {
                cmd.push_str(&format!(" -p {}", trimmed));
            }
        }
    }
    if let Some(envs) = env_vars {
        for env in envs {
            let trimmed = env.trim();
            if !trimmed.is_empty() {
                cmd.push_str(&format!(" -e {}", trimmed));
            }
        }
    }
    cmd.push_str(&format!(" {} 2>&1", clean_image));

    let output = run_exec(&state, &cmd).await?;
    Ok(output)
}

#[tauri::command]
pub async fn docker_inspect_container(container_id: String, state: State<'_, SshState>) -> Result<String, AppError> {
    let clean = container_id.trim();
    if clean.is_empty() {
        return Err(AppError::Message("ID de conteneur invalide".into()));
    }
    let cmd = format!("docker inspect {} 2>&1", clean);
    let output = run_exec(&state, &cmd).await?;
    Ok(output)
}

#[tauri::command]
pub async fn docker_update_container(
    container_id: String,
    new_name: Option<String>,
    restart_policy: Option<String>,
    state: State<'_, SshState>
) -> Result<(), AppError> {
    let clean_id = container_id.trim();
    if clean_id.is_empty() {
        return Err(AppError::Message("ID de conteneur invalide".into()));
    }

    if let Some(policy) = restart_policy {
        let clean_p = policy.trim();
        if !clean_p.is_empty() {
            let cmd = format!("docker update --restart {} {}", clean_p, clean_id);
            let _ = run_exec(&state, &cmd).await;
        }
    }

    if let Some(name) = new_name {
        let clean_name = name.trim();
        if !clean_name.is_empty() {
            let cmd = format!("docker rename {} {}", clean_id, clean_name);
            let _ = run_exec(&state, &cmd).await;
        }
    }

    // Restart the container to apply changes
    let restart_cmd = format!("docker restart -t 10 {}", clean_id);
    run_exec(&state, &restart_cmd).await?;

    Ok(())
}

#[tauri::command]
pub async fn docker_recreate_container(
    container_id: String,
    image: String,
    name: String,
    ports: Option<String>,
    env_vars: Option<Vec<String>>,
    restart_policy: Option<String>,
    state: State<'_, SshState>
) -> Result<String, AppError> {
    let clean_id = container_id.trim();
    if clean_id.is_empty() {
        return Err(AppError::Message("ID de conteneur invalide".into()));
    }

    // 1. Remove existing container
    let stop_rm_cmd = format!("docker rm -f {}", clean_id);
    let _ = run_exec(&state, &stop_rm_cmd).await;

    // 2. Run new container with updated config
    let mut cmd = String::from("docker run -d --security-opt seccomp=unconfined --security-opt apparmor=unconfined");
    let clean_name = name.trim();
    if !clean_name.is_empty() {
        cmd.push_str(&format!(" --name {}", clean_name));
    }
    if let Some(policy) = restart_policy {
        let clean_p = policy.trim();
        if !clean_p.is_empty() {
            cmd.push_str(&format!(" --restart {}", clean_p));
        }
    }
    if let Some(p) = ports {
        for port_pair in p.split(',') {
            let trimmed = port_pair.trim();
            if !trimmed.is_empty() {
                cmd.push_str(&format!(" -p {}", trimmed));
            }
        }
    }
    if let Some(envs) = env_vars {
        for env in envs {
            let trimmed = env.trim();
            if !trimmed.is_empty() {
                cmd.push_str(&format!(" -e {}", trimmed));
            }
        }
    }
    cmd.push_str(&format!(" {} 2>&1", image.trim()));

    let output = run_exec(&state, &cmd).await?;
    Ok(output)
}
