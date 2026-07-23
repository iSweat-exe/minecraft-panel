use crate::error::AppError;
use crate::node_client::DaemonClient;
use protocol::{
    ContainerSpec, DaemonInfoResponse, PowerActionResponse, ServerPowerAction,
    ServerStatusResponse,
};

#[tauri::command]
pub async fn node_get_info(
    node_url: String,
    node_token: String,
) -> Result<DaemonInfoResponse, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.get_info().await
}

#[tauri::command]
pub async fn node_list_servers(
    node_url: String,
    node_token: String,
) -> Result<Vec<ServerStatusResponse>, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.list_servers().await
}

#[tauri::command]
pub async fn node_create_server(
    node_url: String,
    node_token: String,
    spec: ContainerSpec,
) -> Result<String, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.create_server(spec).await
}

#[tauri::command]
pub async fn node_power_action(
    node_url: String,
    node_token: String,
    server_id: String,
    action: ServerPowerAction,
) -> Result<PowerActionResponse, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.power_action(&server_id, action).await
}

#[tauri::command]
pub async fn node_delete_server(
    node_url: String,
    node_token: String,
    server_id: String,
) -> Result<String, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.delete_server(&server_id).await
}

#[tauri::command]
pub fn node_generate_console_token(
    server_id: String,
    jwt_secret: String,
    sub: Option<String>,
    duration_secs: Option<u64>,
) -> Result<String, AppError> {
    let user_sub = sub.unwrap_or_else(|| "panel_user".to_string());
    let duration = duration_secs.unwrap_or(600); // default 10 minutes
    let permissions = vec![
        "console:read".to_string(),
        "console:write".to_string(),
        "power:control".to_string(),
    ];

    DaemonClient::mint_session_jwt(&user_sub, &server_id, permissions, &jwt_secret, duration)
}
