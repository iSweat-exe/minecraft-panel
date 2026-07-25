use axum::{
    extract::{Path, State},
    Json,
};
use protocol::ApiResponse;
use serde::{Deserialize, Serialize};
use tokio::process::Command as TokioCommand;

use crate::{auth::NodeAuth, AppState};

#[derive(Serialize)]
pub struct BackupInfo {
    pub name: String,
    pub size: u64,
    pub created_at: i64,
}

pub async fn list_backups(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
) -> Json<ApiResponse<Vec<BackupInfo>>> {
    let mut backups = Vec::new();

    let path = format!("{}/backups/{}", state.config.data_dir, server_id);
    if let Ok(mut entries) = tokio::fs::read_dir(&path).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Ok(metadata) = entry.metadata().await {
                if metadata.is_file() {
                    backups.push(BackupInfo {
                        name: entry.file_name().to_string_lossy().to_string(),
                        size: metadata.len(),
                        created_at: metadata
                            .modified()
                            .ok()
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs() as i64)
                            .unwrap_or(0),
                    });
                }
            }
        }
    }

    Json(ApiResponse::ok(backups))
}

#[derive(Deserialize)]
pub struct CreateBackupRequest {
    pub name: Option<String>,
}

pub async fn create_backup(
    _auth: NodeAuth,
    Path(server_id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<CreateBackupRequest>,
) -> Json<ApiResponse<String>> {
    let source_dir = format!("{}/{}", state.config.data_dir, server_id);
    let backup_dir = format!("{}/backups/{}", state.config.data_dir, server_id);
    let _ = tokio::fs::create_dir_all(&backup_dir).await;

    let backup_name = payload
        .name
        .unwrap_or_else(|| format!("{}_{}.tar.gz", server_id, chrono::Utc::now().timestamp()));
    let backup_path = format!("{}/{}", backup_dir, backup_name);

    let output = TokioCommand::new("tar")
        .arg("-czf")
        .arg(&backup_path)
        .arg("-C")
        .arg(&source_dir)
        .arg(".")
        .output()
        .await;

    match output {
        Ok(out) if out.status.success() => Json(ApiResponse::ok("Backup created".to_string())),
        Ok(out) => Json(ApiResponse::err(
            String::from_utf8_lossy(&out.stderr).to_string(),
        )),
        Err(e) => Json(ApiResponse::err(e.to_string())),
    }
}
