use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use protocol::ClientWsMessage;
use tracing::info;

use crate::routes::AppState;
use crate::services::auth::SessionAuth;

#[utoipa::path(
    summary = "Ws Stream Handler",
    get,
    path = "/api/v1/servers/{server_id}/stream",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    responses(
        (status = 101, description = "Upgrade to websocket")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn ws_stream_handler(
    ws: WebSocketUpgrade,
    Path(server_id): Path<String>,
    auth: Result<SessionAuth, (axum::http::StatusCode, &'static str)>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let (claims, raw_token) = match auth {
        Ok(SessionAuth {
            claims: c,
            raw_token: t,
        }) => (c, t),
        Err((status, msg)) => return (status, msg).into_response(),
    };

    if claims.server_id != server_id && claims.server_id != "*" {
        return (
            axum::http::StatusCode::FORBIDDEN,
            "Token not authorized for this server",
        )
            .into_response();
    }

    let has_read = claims
        .permissions
        .iter()
        .any(|p| p == "*" || p == "console:read");
    if !has_read {
        return (
            axum::http::StatusCode::FORBIDDEN,
            "Missing stream permissions",
        )
            .into_response();
    }

    ws.protocols([raw_token])
        .on_upgrade(move |socket| handle_ws_socket(socket, server_id, state, claims))
}

async fn handle_ws_socket(
    socket: WebSocket,
    server_id: String,
    state: AppState,
    claims: protocol::DaemonClaims,
) {
    let (mut sender, mut receiver) = socket.split();

    // Subscribe to the centralized EventBus
    let mut rx = state
        .stream_mgr
        .subscribe(&server_id, state.docker.clone(), state.console_mgr.clone())
        .await;

    info!(server_id = %server_id, "WebSocket stream connected");

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Ok(text) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(text.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    let s_id = server_id.clone();
    let console_mgr = state.console_mgr.clone();
    let docker = state.docker.clone();

    let mut recv_task = tokio::spawn(async move {
        let has_write = claims
            .permissions
            .iter()
            .any(|p| p == "*" || p == "console:write");

        while let Some(Ok(Message::Text(text))) = receiver.next().await {
            if let Ok(client_msg) = serde_json::from_str::<ClientWsMessage>(&text) {
                match client_msg {
                    ClientWsMessage::SendCommand { command } => {
                        if has_write {
                            let _ = console_mgr.send_command(&s_id, &command).await;
                        }
                    }
                    ClientWsMessage::ResizePty { cols, rows } => {
                        if has_write {
                            let _ = docker.resize_tty(&s_id, cols, rows).await;
                        }
                    }
                    ClientWsMessage::Ping => {}
                    _ => {}
                }
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
        },
        _ = (&mut recv_task) => {
            send_task.abort();
        },
    };

    info!(server_id = %server_id, "WebSocket stream disconnected");
}
