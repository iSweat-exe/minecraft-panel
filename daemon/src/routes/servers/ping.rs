use axum::extract::{Path, State};
use axum::Json;
use protocol::{ApiResponse, MinecraftPingResponse};

use crate::auth::NodeAuth;
use crate::routes::AppState;

pub async fn server_ping(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<MinecraftPingResponse>> {
    let container_name = format!("mc-server-{}", id);
    let inspect = match state
        .docker
        .docker_client()
        .inspect_container(&container_name, None)
        .await
    {
        Ok(info) => info,
        Err(_) => return Json(ApiResponse::err("Server container not found")),
    };

    // Find the port binding
    let mut target_port = 25565; // default fallback
    if let Some(host_config) = inspect.host_config {
        if let Some(bindings) = host_config.port_bindings {
            if let Some(Some(host_bindings)) = bindings.get("25565/tcp") {
                if let Some(binding) = host_bindings.first() {
                    if let Some(port) = &binding.host_port {
                        if let Ok(p) = port.parse::<u16>() {
                            target_port = p;
                        }
                    }
                }
            } else {
                for (_, host_bindings) in bindings {
                    if let Some(host_bindings) = host_bindings {
                        if let Some(binding) = host_bindings.first() {
                            if let Some(port) = &binding.host_port {
                                if let Ok(p) = port.parse::<u16>() {
                                    target_port = p;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let mut stream = match tokio::net::TcpStream::connect(("127.0.0.1", target_port)).await {
        Ok(s) => s,
        Err(e) => {
            return Json(ApiResponse::err(format!(
                "Failed to connect to server: {}",
                e
            )))
        }
    };

    match craftping::tokio::ping(&mut stream, "127.0.0.1", target_port).await {
        Ok(pong) => Json(ApiResponse::ok(MinecraftPingResponse {
            online_players: pong.online_players as u32,
            max_players: pong.max_players as u32,
            motd: pong.description.map(|d| d.to_string()).unwrap_or_default(),
            version: pong.version,
        })),
        Err(e) => Json(ApiResponse::err(format!("Ping failed: {}", e))),
    }
}
