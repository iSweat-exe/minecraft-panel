use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use protocol::{ClientWsMessage, DaemonWsMessage};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{error, info};

use crate::auth::SessionAuth;
use crate::routes::AppState;

pub async fn ws_console_handler(
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
    let (mut sender, receiver) = socket.split();
    let (tx, rx) = broadcast::channel::<String>(100);

    let console_mgr =
        crate::console::ConsoleStreamManager::new(Arc::new(state.docker.docker_client().clone()));

    if let Err(err) = console_mgr
        .attach_and_broadcast(&server_id, tx.clone())
        .await
    {
        error!(server_id = %server_id, error = format!("{:#}", anyhow::anyhow!(err.to_string())), "Failed to attach console stream");
        let err_msg = serde_json::to_string(&DaemonWsMessage::Error {
            message: err.to_string(),
        })
        .unwrap_or_default();
        let _ = sender.send(Message::Text(err_msg.into())).await;
        return;
    }

    info!(server_id = %server_id, "WebSocket console connected");

    let mut send_task = spawn_ws_sender(server_id.clone(), rx, sender);
    let mut recv_task = spawn_ws_receiver(
        server_id.clone(),
        state.docker.clone(),
        Arc::new(console_mgr),
        receiver,
    );

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    info!(server_id = %server_id, "WebSocket console disconnected");
}

fn spawn_ws_sender(
    server_id: String,
    mut rx: broadcast::Receiver<String>,
    mut sender: futures_util::stream::SplitSink<WebSocket, Message>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        while let Ok(line) = rx.recv().await {
            let msg = DaemonWsMessage::ConsoleOutput {
                server_id: server_id.clone(),
                line,
            };
            if let Ok(text) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(text.into())).await.is_err() {
                    break;
                }
            }
        }
    })
}

fn spawn_ws_receiver(
    server_id: String,
    docker: crate::docker::DockerManager,
    console_mgr: Arc<crate::console::ConsoleStreamManager>,
    mut receiver: futures_util::stream::SplitStream<WebSocket>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            if let Ok(client_msg) = serde_json::from_str::<ClientWsMessage>(&text) {
                match client_msg {
                    ClientWsMessage::SendCommand { command } => {
                        let _ = console_mgr.send_command(&server_id, &command).await;
                    }
                    ClientWsMessage::ResizePty { cols, rows } => {
                        let _ = docker.resize_tty(&server_id, cols, rows).await;
                    }
                    ClientWsMessage::Ping => {}
                    _ => {}
                }
            }
        }
    })
}
