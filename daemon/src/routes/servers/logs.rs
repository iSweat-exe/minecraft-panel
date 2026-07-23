use axum::extract::{Path, Query, State};
use axum::Json;
use protocol::{ApiResponse, ServerLogsResponse};

use crate::auth::NodeAuth;
use crate::routes::AppState;
use bollard::container::LogsOptions;
use futures_util::StreamExt;

#[derive(serde::Deserialize)]
pub struct LogsQuery {
    pub lines: Option<usize>,
}

pub async fn server_logs(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<LogsQuery>,
) -> Json<ApiResponse<ServerLogsResponse>> {
    let container_name = format!("mc-server-{}", id);
    let lines = query.lines.unwrap_or(100).to_string();

    let options = LogsOptions::<String> {
        stdout: true,
        stderr: true,
        tail: lines,
        ..Default::default()
    };

    let mut stream = state
        .docker
        .docker_client()
        .logs(&container_name, Some(options));
    let mut log_lines = Vec::new();

    while let Some(Ok(msg)) = stream.next().await {
        let line = String::from_utf8_lossy(msg.into_bytes().as_ref()).to_string();
        // Remove trailing newline if present
        log_lines.push(line.trim_end().to_string());
    }

    Json(ApiResponse::ok(ServerLogsResponse { lines: log_lines }))
}
