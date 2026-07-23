use crate::error::AppError;
use crate::node_client::DaemonClient;
use protocol::{DockerContainerInfo, DockerImageInfo, DockerRunRequest, DockerUpdateRequest};

#[tauri::command]
pub async fn node_docker_list_containers(node_url: String, node_token: String) -> Result<Vec<DockerContainerInfo>, AppError> {
    DaemonClient::new(node_url, node_token).docker_list_containers().await
}

#[tauri::command]
pub async fn node_docker_container_action(
    node_url: String, node_token: String,
    container_id: String,
    action: String,
) -> Result<String, AppError> {
    DaemonClient::new(node_url, node_token).docker_container_action(&container_id, &action).await
}

#[tauri::command]
pub async fn node_docker_system_prune(node_url: String, node_token: String) -> Result<String, AppError> {
    DaemonClient::new(node_url, node_token).docker_system_prune().await
}

#[tauri::command]
pub async fn node_docker_container_logs(
    node_url: String, node_token: String,
    container_name: String,
    _tail: Option<u32>,
) -> Result<String, AppError> {
    DaemonClient::new(node_url, node_token).docker_container_logs(&container_name).await
}

#[tauri::command]
pub async fn node_docker_list_images(node_url: String, node_token: String) -> Result<Vec<DockerImageInfo>, AppError> {
    DaemonClient::new(node_url, node_token).docker_list_images().await
}

#[tauri::command]
pub async fn node_docker_pull_image(node_url: String, node_token: String, image_name: String) -> Result<String, AppError> {
    DaemonClient::new(node_url, node_token).docker_pull_image(&image_name).await
}

#[tauri::command]
pub async fn node_docker_remove_image(node_url: String, node_token: String, image_id: String) -> Result<String, AppError> {
    DaemonClient::new(node_url, node_token).docker_remove_image(&image_id).await
}

#[tauri::command]
pub async fn node_docker_run_container(
    node_url: String, node_token: String,
    image: String,
    name: Option<String>,
    ports: Option<String>,
    env_vars: Option<Vec<String>>,
    restart_policy: Option<String>,
) -> Result<String, AppError> {
    let req = DockerRunRequest { image, name, ports, env_vars, restart_policy };
    DaemonClient::new(node_url, node_token).docker_run_container(req).await
}

#[tauri::command]
pub async fn node_docker_inspect_container(node_url: String, node_token: String, container_id: String) -> Result<String, AppError> {
    DaemonClient::new(node_url, node_token).docker_container_inspect(&container_id).await
}

#[tauri::command]
pub async fn node_docker_update_container(
    node_url: String, node_token: String,
    container_id: String,
    new_name: Option<String>,
    restart_policy: Option<String>,
) -> Result<String, AppError> {
    let req = DockerUpdateRequest { new_name, restart_policy };
    DaemonClient::new(node_url, node_token).docker_update_container(&container_id, req).await
}

#[tauri::command]
pub async fn node_docker_recreate_container(
    node_url: String, node_token: String,
    container_id: String,
    image: String,
    name: Option<String>, // the UI sends name as required, but the struct has Option<String>, we'll map it. Wait, the frontend sends name, so we can map it.
    ports: Option<String>,
    env_vars: Option<Vec<String>>,
    restart_policy: Option<String>,
) -> Result<String, AppError> {
    let req = DockerRunRequest { image, name, ports, env_vars, restart_policy };
    DaemonClient::new(node_url, node_token).docker_recreate_container(&container_id, req).await
}
