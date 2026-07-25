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

    let has_read = claims.permissions.iter().any(|p| p == "*" || p == "console:read");
    if !has_read {
        return (
            axum::http::StatusCode::FORBIDDEN,
            "Missing console:read permission",
        )
            .into_response();
    }

    ws.on_upgrade(move |socket| handle_ws_socket(socket, id, state, claims))
}

async fn handle_ws_socket(socket: WebSocket, server_id: String, state: AppState, claims: protocol::DaemonClaims) {
    let (mut sender, receiver) = socket.split();
    let (tx, rx) = broadcast::channel::<String>(100);

    let console_mgr = state.console_mgr.clone();

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
        console_mgr,
        receiver,
        claims,
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
    claims: protocol::DaemonClaims,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let has_write = claims.permissions.iter().any(|p| p == "*" || p == "console:write");

        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            if let Ok(client_msg) = serde_json::from_str::<ClientWsMessage>(&text) {
                match client_msg {
                    ClientWsMessage::SendCommand { command } => {
                        if has_write {
                            let _ = console_mgr.send_command(&server_id, &command).await;
                        }
                    }
                    ClientWsMessage::ResizePty { cols, rows } => {
                        if has_write {
                            let _ = docker.resize_tty(&server_id, cols, rows).await;
                        }
                    }
                    ClientWsMessage::Ping => {}
                    _ => {}
                }
            }
        }
    })
}
