use anyhow::{Context, Result};
use axum::Json;
use protocol::{CrontabUpdateRequest};
use tokio::process::Command;

use crate::services::auth::NodeAuth;

#[utoipa::path(
    tag = "Node Management",
    summary = "Retrieve the current system or user crontab configuration",
    get,
    path = "/api/v1/node/crontab",
    responses(
        (status = 200, description = "Get node crontab", body = inline(protocol::String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_crontab(_auth: NodeAuth) -> Result<Json<String>, crate::error::DaemonError> {
    match get_crontab_impl().await.context("Failed to get crontab") {
        Ok(s) => Ok(Json(s)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}

async fn get_crontab_impl() -> Result<String> {
    let output = Command::new("crontab")
        .arg("-l")
        .output()
        .await
        .context("Failed to execute 'crontab -l' command")?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        if err_msg.contains("no crontab") {
            Ok(String::new())
        } else {
            anyhow::bail!("crontab -l returned error: {}", err_msg)
        }
    }
}

#[utoipa::path(
    tag = "Node Management",
    summary = "Update the system or user crontab configuration",
    put,
    path = "/api/v1/node/crontab",
    request_body = protocol::CrontabUpdateRequest,
    responses(
        (status = 200, description = "Update node crontab", body = inline(protocol::String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn update_crontab(
    _auth: NodeAuth,
    Json(payload): Json<CrontabUpdateRequest>,
) -> Result<Json<String>, crate::error::DaemonError> {
    match update_crontab_impl(payload.content)
        .await
        .context("Failed to update crontab")
    {
        Ok(s) => Ok(Json(s)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}

async fn update_crontab_impl(content: String) -> Result<String> {
    let temp_file = std::env::temp_dir().join("daemon_crontab.tmp");
    tokio::fs::write(&temp_file, &content)
        .await
        .context("Failed to write crontab to temporary file")?;

    let output = Command::new("crontab")
        .arg(&temp_file)
        .output()
        .await
        .context("Failed to execute 'crontab' command with temp file")?;

    let _ = tokio::fs::remove_file(&temp_file).await;

    if output.status.success() {
        Ok("Crontab updated".to_string())
    } else {
        anyhow::bail!(
            "crontab command returned error: {}",
            String::from_utf8_lossy(&output.stderr)
        )
    }
}
