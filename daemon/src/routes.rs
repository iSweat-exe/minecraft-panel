use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::Json;
use futures_util::{SinkExt, StreamExt};
use protocol::{
    ApiResponse, ClientWsMessage, CreateServerRequest, DaemonInfoResponse, DaemonWsMessage,
    PowerActionRequest, PowerActionResponse, ServerStatusResponse,
};
use tokio::sync::broadcast;
use tracing::{error, info};

use crate::auth::{NodeAuth, SessionAuth};
use crate::config::DaemonConfig;
use crate::docker::DockerManager;
use protocol::{
    FileEntry, FileActionRequest, FileWriteRequest, SystemMetricsResponse
};

#[derive(Clone)]
pub struct AppState {
    pub config: DaemonConfig,
    pub docker: DockerManager,
    pub start_time: std::time::Instant,
}

pub fn create_router(state: AppState) -> axum::Router {
    axum::Router::new()
        .route("/api/v1/info", get(get_info))
        .route("/api/v1/metrics", get(get_metrics))
        .route("/api/v1/update", post(trigger_update))
        .route("/api/v1/servers", get(list_servers).post(create_server))
        .route("/api/v1/servers/{id}/power", post(server_power))
        .route("/api/v1/servers/{id}/command", post(server_command))
        .route("/api/v1/servers/{id}/inspect", get(server_inspect))
        .route("/api/v1/servers/{id}", axum::routing::delete(delete_server))
        .route("/api/v1/servers/{id}/ws", get(ws_console_handler))
        .route("/api/v1/files/list", get(list_files))
        .route("/api/v1/files/read", get(read_file))
        .route("/api/v1/files/download", get(download_file))
        .route("/api/v1/files/write", post(write_file))
        .route("/api/v1/files/upload", post(upload_file))
        .route("/api/v1/files/action", post(file_action))
        .layer(axum::Extension(state.config.clone()))
        .with_state(state)
}



async fn trigger_update(
    _auth: NodeAuth,
    Json(payload): Json<protocol::UpdateDaemonRequest>,
) -> Json<ApiResponse<protocol::UpdateDaemonResponse>> {
    match crate::update::AutoUpdater::apply_update(payload).await {
        Ok(res) => Json(ApiResponse::ok(res)),
        Err(err) => Json(ApiResponse::err(err.to_string())),
    }
}

async fn get_metrics(_auth: NodeAuth) -> Json<ApiResponse<SystemMetricsResponse>> {
    match crate::metrics::get_metrics() {
        Ok(data) => Json(ApiResponse::ok(data)),
        Err(err) => Json(ApiResponse::err(err.to_string())),
    }
}

#[derive(serde::Deserialize)]
struct FileQuery {
    path: String,
}

async fn list_files(
    _auth: NodeAuth,
    axum::extract::Query(query): axum::extract::Query<FileQuery>,
) -> Json<ApiResponse<Vec<FileEntry>>> {
    match crate::files::list_dir(&query.path).await {
        Ok(data) => Json(ApiResponse::ok(data)),
        Err(err) => Json(ApiResponse::err(err.to_string())),
    }
}

async fn read_file(
    _auth: NodeAuth,
    axum::extract::Query(query): axum::extract::Query<FileQuery>,
) -> Json<ApiResponse<String>> {
    match crate::files::read_file(&query.path).await {
        Ok(data) => {
            // Using base64 to avoid JSON encoding issues with binary files
            use base64::{Engine as _, engine::general_purpose::STANDARD};
            Json(ApiResponse::ok(STANDARD.encode(&data)))
        }
        Err(err) => Json(ApiResponse::err(err.to_string())),
    }
}

async fn download_file(
    _auth: NodeAuth,
    axum::extract::Query(query): axum::extract::Query<FileQuery>,
) -> impl IntoResponse {
    match crate::files::read_file(&query.path).await {
        Ok(data) => {
            let filename = std::path::Path::new(&query.path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            (
                axum::http::StatusCode::OK,
                [(axum::http::header::CONTENT_TYPE, "application/octet-stream"),
                 (axum::http::header::CONTENT_DISPOSITION, &format!("attachment; filename=\"{}\"", filename))],
                data,
            ).into_response()
        }
        Err(err) => {
            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, err.to_string()).into_response()
        }
    }
}

async fn write_file(
    _auth: NodeAuth,
    axum::extract::Query(query): axum::extract::Query<FileQuery>,
    Json(payload): Json<FileWriteRequest>,
) -> Json<ApiResponse<String>> {
    match crate::files::write_file(&query.path, payload.content.as_bytes()).await {
        Ok(_) => Json(ApiResponse::ok("File written".to_string())),
        Err(err) => Json(ApiResponse::err(err.to_string())),
    }
}

async fn upload_file(
    _auth: NodeAuth,
    axum::extract::Query(query): axum::extract::Query<FileQuery>,
    body: axum::body::Bytes,
) -> Json<ApiResponse<String>> {
    match crate::files::write_file(&query.path, &body).await {
        Ok(_) => Json(ApiResponse::ok("File uploaded".to_string())),
        Err(err) => Json(ApiResponse::err(err.to_string())),
    }
}


async fn file_action(
    _auth: NodeAuth,
    axum::extract::Query(query): axum::extract::Query<FileQuery>,
    Json(payload): Json<FileActionRequest>,
) -> Json<ApiResponse<String>> {
    match crate::files::perform_action(&query.path, payload.action).await {
        Ok(_) => Json(ApiResponse::ok("Action executed".to_string())),
        Err(err) => Json(ApiResponse::err(err.to_string())),
    }
}

async fn get_info(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Json<ApiResponse<DaemonInfoResponse>> {
    let servers = state.docker.list_managed_containers().await.unwrap_or_default();
    let running = servers.iter().filter(|s| s.state == "running").count();

    Json(ApiResponse::ok(DaemonInfoResponse {
        version: env!("CARGO_PKG_VERSION").to_string(),
        protocol_version: protocol::PROTOCOL_VERSION,
        node_id: state.config.node_id.clone(),
        docker_version: "24.0".to_string(),
        total_servers: servers.len(),
        running_servers: running,
        uptime_seconds: state.start_time.elapsed().as_secs(),
    }))

}

async fn list_servers(
    _auth: NodeAuth,
    State(state): State<AppState>,
) -> Json<ApiResponse<Vec<ServerStatusResponse>>> {
    match state.docker.list_managed_containers().await {
        Ok(list) => Json(ApiResponse::ok(list)),
        Err(err) => Json(ApiResponse::err(err.to_string())),
    }
}

async fn create_server(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Json(payload): Json<CreateServerRequest>,
) -> Json<ApiResponse<String>> {
    match state.docker.create_server_container(&payload.spec).await {
        Ok(container_id) => Json(ApiResponse::ok(container_id)),
        Err(err) => Json(ApiResponse::err(err.to_string())),
    }
}

async fn server_power(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<PowerActionRequest>,
) -> Json<ApiResponse<PowerActionResponse>> {
    let action = payload.action;
    match state.docker.power_action(&id, action.clone()).await {
        Ok(_) => Json(ApiResponse::ok(PowerActionResponse {
            server_id: id,
            action,
            success: true,
            message: "Action executed successfully".to_string(),
        })),
        Err(err) => Json(ApiResponse::err(err.to_string())),
    }
}

async fn delete_server(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<String>> {
    match state.docker.remove_container(&id).await {
        Ok(_) => Json(ApiResponse::ok(format!("Server {} removed", id))),
        Err(err) => Json(ApiResponse::err(err.to_string())),
    }
}

#[derive(serde::Deserialize)]
pub struct ServerCommandRequest {
    pub command: String,
}

async fn server_command(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<ServerCommandRequest>,
) -> Json<ApiResponse<String>> {
    let console_mgr = crate::console::ConsoleStreamManager::new(
        Arc::new(state.docker.docker_client().clone()),
    );
    match console_mgr.send_command(&id, &payload.command).await {
        Ok(_) => Json(ApiResponse::ok("Command sent".to_string())),
        Err(err) => Json(ApiResponse::err(err.to_string())),
    }
}

async fn server_inspect(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<bollard::models::ContainerInspectResponse>> {
    match state.docker.docker_client().inspect_container(&id, None).await {
        Ok(info) => Json(ApiResponse::ok(info)),
        Err(err) => Json(ApiResponse::err(err.to_string())),
    }
}

async fn ws_console_handler(
    _ver: crate::auth::ProtocolVersionCheck,
    ws: WebSocketUpgrade,
    Path(id): Path<String>,
    auth: Result<SessionAuth, (axum::http::StatusCode, &'static str)>,
    State(state): State<AppState>,
) -> impl IntoResponse {

    let claims = match auth {
        Ok(SessionAuth(c)) => c,
        Err((status, msg)) => return (status, msg).into_response(),
    };

    if claims.server_id != id && claims.server_id != "*" {
        return (
            axum::http::StatusCode::FORBIDDEN,
            "Token not authorized for this server",
        )
            .into_response();
    }

    ws.on_upgrade(move |socket| handle_ws_socket(socket, id, state))
}

async fn handle_ws_socket(socket: WebSocket, server_id: String, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = broadcast::channel::<String>(100);

    let console_mgr = crate::console::ConsoleStreamManager::new(
        Arc::new(state.docker.docker_client().clone()),
    );

    if let Err(err) = console_mgr.attach_and_broadcast(&server_id, tx.clone()).await {
        error!(server_id = %server_id, error = %err, "Failed to attach console stream");
        let err_msg = serde_json::to_string(&DaemonWsMessage::Error {
            message: err.to_string(),
        })
        .unwrap_or_default();
        let _ = sender.send(Message::Text(err_msg.into())).await;
        return;
    }

    info!(server_id = %server_id, "WebSocket console connected");

    // Task to forward broadcast lines to WS client
    let server_id_clone = server_id.clone();
    let mut send_task = tokio::spawn(async move {
        while let Ok(line) = rx.recv().await {
            let msg = DaemonWsMessage::ConsoleOutput {
                server_id: server_id_clone.clone(),
                line,
            };
            if let Ok(text) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(text.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    // Task to process client messages (SendCommand, ResizePty, Ping)
    let console_mgr_arc = Arc::new(console_mgr);
    let docker_clone = state.docker.clone();
    let server_id_input = server_id.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            if let Ok(client_msg) = serde_json::from_str::<ClientWsMessage>(&text) {
                match client_msg {
                    ClientWsMessage::SendCommand { command } => {
                        let _ = console_mgr_arc.send_command(&server_id_input, &command).await;
                    }
                    ClientWsMessage::ResizePty { cols, rows } => {
                        let _ = docker_clone.resize_tty(&server_id_input, cols, rows).await;
                    }
                    ClientWsMessage::Ping => {}
                    _ => {}
                }
            }
        }
    });


    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    info!(server_id = %server_id, "WebSocket console disconnected");
}
