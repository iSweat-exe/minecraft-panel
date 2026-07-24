use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::process::Command as StdCommand;

use crate::{auth::NodeAuth, AppState};

#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct BackupInfo {
    pub name: String,
    pub size: u64,
    pub created_at: i64,
}

pub async fn list_backups(
    _auth: NodeAuth,
    Path(server_id): Path<String>,
) -> Json<ApiResponse<Vec<BackupInfo>>> {
    let mut backups = Vec::new();

    let path = format!("/backups/{}", server_id);
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

    Json(ApiResponse {
        success: true,
        data: Some(backups),
        error: None,
    })
}

#[derive(Deserialize)]
pub struct CreateBackupRequest {
    pub name: Option<String>,
}

pub async fn create_backup(
    _auth: NodeAuth,
    Path(server_id): Path<String>,
    State(_state): State<AppState>,
    Json(payload): Json<CreateBackupRequest>,
) -> Json<ApiResponse<String>> {
    let source_dir = format!("/var/lib/docker/volumes/{}_data/_data", server_id);
    let backup_dir = format!("/backups/{}", server_id);
    let _ = tokio::fs::create_dir_all(&backup_dir).await;

    let backup_name = payload
        .name
        .unwrap_or_else(|| format!("{}_{}.tar.gz", server_id, chrono::Utc::now().timestamp()));
    let backup_path = format!("{}/{}", backup_dir, backup_name);

    let output = StdCommand::new("tar")
        .arg("-czf")
        .arg(&backup_path)
        .arg("-C")
        .arg(&source_dir)
        .arg(".")
        .output();

    match output {
        Ok(out) if out.status.success() => Json(ApiResponse {
            success: true,
            data: Some("Backup created".to_string()),
            error: None,
        }),
        Ok(out) => Json(ApiResponse {
            success: false,
            data: None,
            error: Some(String::from_utf8_lossy(&out.stderr).to_string()),
        }),
        Err(e) => Json(ApiResponse {
            success: false,
            data: None,
            error: Some(e.to_string()),
        }),
    }
}
