use anyhow::Context;
use axum::extract::Query;
use axum::Json;
use protocol::{ApiResponse, ServerLogsResponse};

use crate::auth::NodeAuth;

#[derive(serde::Deserialize)]
pub struct LogsQuery {
    pub lines: Option<usize>,
}

pub async fn get_logs(
    _auth: NodeAuth,
    Query(query): Query<LogsQuery>,
) -> Json<ApiResponse<ServerLogsResponse>> {
    let lines_count = query.lines.unwrap_or(100);

    match get_logs_impl(lines_count).await {
        Ok(lines) => Json(ApiResponse::ok(ServerLogsResponse { lines })),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

async fn get_logs_impl(lines_count: usize) -> anyhow::Result<Vec<String>> {
    use tokio::io::{AsyncReadExt, AsyncSeekExt};

    let mut file = tokio::fs::File::open("daemon.log")
        .await
        .context("Failed to open daemon.log")?;

    let file_len = file.metadata().await?.len();
    if file_len == 0 {
        return Ok(Vec::new());
    }

    // Read at most 1 MB from the end — enough for ~10k lines of typical log output.
    const MAX_TAIL_BYTES: u64 = 1024 * 1024;
    let read_start = file_len.saturating_sub(MAX_TAIL_BYTES);
    file.seek(std::io::SeekFrom::Start(read_start)).await?;

    let mut buf = String::new();
    file.read_to_string(&mut buf).await?;

    let lines: Vec<&str> = buf.lines().collect();
    let start_idx = lines.len().saturating_sub(lines_count);
    let result = lines[start_idx..].iter().map(|s| s.to_string()).collect();
    Ok(result)
}
