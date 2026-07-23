use anyhow::{Context, Result};
use axum::Json;
use protocol::{ApiResponse, CrontabUpdateRequest};
use std::process::Command;

use crate::auth::NodeAuth;

pub async fn get_crontab(_auth: NodeAuth) -> Json<ApiResponse<String>> {
    match get_crontab_impl().context("Failed to get crontab") {
        Ok(s) => Json(ApiResponse::ok(s)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

fn get_crontab_impl() -> Result<String> {
    let output = Command::new("crontab")
        .arg("-l")
        .output()
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

pub async fn update_crontab(
    _auth: NodeAuth,
    Json(payload): Json<CrontabUpdateRequest>,
) -> Json<ApiResponse<String>> {
    match update_crontab_impl(payload.content).context("Failed to update crontab") {
        Ok(s) => Json(ApiResponse::ok(s)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

fn update_crontab_impl(content: String) -> Result<String> {
    let temp_file = std::env::temp_dir().join("daemon_crontab.tmp");
    std::fs::write(&temp_file, &content).context("Failed to write crontab to temporary file")?;

    let output = Command::new("crontab")
        .arg(&temp_file)
        .output()
        .context("Failed to execute 'crontab' command with temp file")?;

    let _ = std::fs::remove_file(&temp_file);

    if output.status.success() {
        Ok("Crontab updated".to_string())
    } else {
        anyhow::bail!(
            "crontab command returned error: {}",
            String::from_utf8_lossy(&output.stderr)
        )
    }
}
