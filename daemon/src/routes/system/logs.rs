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
    let content = tokio::fs::read_to_string("daemon.log")
        .await
        .context("Failed to read daemon.log")?;

    let lines: Vec<&str> = content.lines().collect();
    let start_idx = if lines.len() > lines_count {
        lines.len() - lines_count
    } else {
        0
    };

    let result = lines[start_idx..].iter().map(|s| s.to_string()).collect();
    Ok(result)
}
