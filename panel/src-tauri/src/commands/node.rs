use crate::error::AppError;
use crate::node_client::DaemonClient;
use protocol::{
    ContainerSpec, DaemonInfoResponse, PowerActionResponse, ServerPowerAction,
    ServerStatusResponse, SystemMetricsResponse, FileEntry, FileAction,
    SystemHostResponse, SystemHealthResponse, ServerLogsResponse, MinecraftPingResponse, ServerCrashesResponse
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
pub async fn node_send_command(
    node_url: String,
    node_token: String,
    server_id: String,
    command: String,
) -> Result<String, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.send_command(&server_id, &command).await
}

#[tauri::command]
pub async fn node_rcon_execute_multi(
    node_url: String,
    node_token: String,
    server_id: String,
    commands: Vec<String>,
) -> Result<Vec<String>, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.rcon_execute_multi(&server_id, commands).await
}

#[tauri::command]
pub async fn node_inspect_container(
    node_url: String,
    node_token: String,
    server_id: String,
) -> Result<serde_json::Value, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.inspect_container(&server_id).await
}

#[tauri::command]
pub async fn node_download_remote(
    node_url: String,
    node_token: String,
    url: String,
    dest: String,
) -> Result<(), AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| AppError::Message(e.to_string()))?;
        
    let res = client.get(&url).send().await.map_err(|e| AppError::Message(e.to_string()))?;
    
    if !res.status().is_success() {
        return Err(AppError::Message(format!("Failed to download {}: HTTP {}", url, res.status())));
    }
    
    let bytes = res.bytes().await.map_err(|e| AppError::Message(e.to_string()))?;
    
    let daemon = DaemonClient::new(node_url, node_token);
    daemon.upload_file(&dest, bytes.to_vec()).await
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

#[tauri::command]
pub async fn node_get_metrics(
    node_url: String,
    node_token: String,
) -> Result<SystemMetricsResponse, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.get_metrics().await
}

#[tauri::command]
pub async fn node_list_dir(
    node_url: String,
    node_token: String,
    path: String,
) -> Result<Vec<FileEntry>, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.list_dir(&path).await
}

#[tauri::command]
pub async fn node_read_file(
    node_url: String,
    node_token: String,
    path: String,
) -> Result<String, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.read_file(&path).await
}

#[tauri::command]
pub async fn node_read_file_text(
    node_url: String,
    node_token: String,
    path: String,
) -> Result<String, AppError> {
    use base64::Engine;
    let client = DaemonClient::new(node_url, node_token);
    let base64_str = client.read_file(&path).await?;
    let bytes = base64::engine::general_purpose::STANDARD.decode(&base64_str)
        .map_err(|e| AppError::Message(format!("Base64 decode error: {}", e)))?;
    String::from_utf8(bytes).map_err(|e| AppError::Message(format!("UTF-8 decode error: {}", e)))
}

#[tauri::command]
pub async fn node_write_file(
    node_url: String,
    node_token: String,
    path: String,
    content: String,
) -> Result<(), AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.write_file(&path, content).await
}

#[tauri::command]
pub async fn node_file_action(
    node_url: String,
    node_token: String,
    path: String,
    action: FileAction,
) -> Result<(), AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.file_action(&path, action).await
}

#[tauri::command]
pub async fn node_upload_file(
    node_url: String,
    node_token: String,
    local_path: String,
    remote_path: String,
) -> Result<(), AppError> {
    let client = DaemonClient::new(node_url, node_token);
    let content = tokio::fs::read(&local_path)
        .await
        .map_err(|e| AppError::Message(format!("Local file read error: {}", e)))?;
    client.upload_file(&remote_path, content).await
}

#[tauri::command]
pub async fn node_download_file(
    node_url: String,
    node_token: String,
    remote_path: String,
    local_path: String,
) -> Result<(), AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| AppError::Message(e.to_string()))?;
        
    let mut url = node_url;
    if url.ends_with('/') {
        url.pop();
    }
    
    let download_url = format!("{}/api/v1/files/download?path={}", url, urlencoding::encode(&remote_path));
    
    let res = client.get(&download_url)
        .header(protocol::NODE_TOKEN_HEADER, node_token)
        .header(protocol::PROTOCOL_VERSION_HEADER, protocol::PROTOCOL_VERSION.to_string())
        .send()
        .await
        .map_err(|e| AppError::Message(e.to_string()))?;
        
    if !res.status().is_success() {
        return Err(AppError::Message(format!("Daemon returned HTTP {}", res.status())));
    }
    
    let bytes = res.bytes().await.map_err(|e| AppError::Message(e.to_string()))?;
    tokio::fs::write(&local_path, bytes).await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn node_get_system_host(
    node_url: String,
    node_token: String,
) -> Result<SystemHostResponse, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.get_system_host().await
}

#[tauri::command]
pub async fn node_get_system_health(
    node_url: String,
    node_token: String,
) -> Result<SystemHealthResponse, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.get_system_health().await
}

#[tauri::command]
pub async fn node_get_system_logs(
    node_url: String,
    node_token: String,
    lines: Option<usize>,
) -> Result<ServerLogsResponse, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.get_system_logs(lines).await
}

#[tauri::command]
pub async fn node_get_server_ping(
    node_url: String,
    node_token: String,
    server_id: String,
) -> Result<MinecraftPingResponse, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.get_server_ping(&server_id).await
}

#[tauri::command]
pub async fn node_get_server_crashes(
    node_url: String,
    node_token: String,
    server_id: String,
) -> Result<ServerCrashesResponse, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.get_server_crashes(&server_id).await
}

#[tauri::command]
pub async fn node_get_server_logs(
    node_url: String,
    node_token: String,
    server_id: String,
    lines: Option<usize>,
) -> Result<ServerLogsResponse, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.get_server_logs(&server_id, lines).await
}
#[tauri::command]
pub async fn node_host_exec(
    node_url: String,
    node_token: String,
    command: String,
) -> Result<protocol::HostExecResponse, AppError> {
    let client = DaemonClient::new(node_url, node_token);
    client.host_exec(&command).await
}
