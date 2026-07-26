use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use protocol::ApiResponse;
use serde::{Deserialize, Serialize};
use tokio::process::Command as TokioCommand;

use crate::{services::auth::NodeAuth, AppState};

#[derive(Serialize, utoipa::ToSchema)]
pub struct BackupInfo {
    pub name: String,
    pub size: u64,
    pub created_at: i64,
}

#[utoipa::path(
    summary = "List Backups",
    get,
    path = "/api/v1/servers/{server_id}/backups",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    responses(
        (status = 200, description = "List backups", body = inline(protocol::ApiResponse<Vec<BackupInfo>>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
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

#[derive(Deserialize, utoipa::ToSchema)]
pub struct CreateBackupRequest {
    pub name: Option<String>,
}

#[derive(Serialize, utoipa::ToSchema)]
pub struct TaskResponse {
    pub task_id: uuid::Uuid,
}

#[utoipa::path(
    summary = "Create Backup",
    post,
    path = "/api/v1/servers/{server_id}/backups",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    request_body = CreateBackupRequest,
    responses(
        (status = 202, description = "Create backup", body = inline(protocol::ApiResponse<TaskResponse>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_backup(
    _auth: NodeAuth,
    Path(server_id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<CreateBackupRequest>,
) -> axum::response::Response {
    let source_dir = format!("{}/{}", state.config.data_dir, server_id);
    let backup_dir = format!("{}/backups/{}", state.config.data_dir, server_id);
    let _ = tokio::fs::create_dir_all(&backup_dir).await;

    let backup_name = payload
        .name
        .unwrap_or_else(|| format!("{}_{}.tar.gz", server_id, chrono::Utc::now().timestamp()));
    let backup_path = format!("{}/{}", backup_dir, backup_name);

    let (task_id, _rx) = state
        .task_mgr
        .create_task(server_id.clone(), "backup".to_string())
        .await;
    let task_mgr = state.task_mgr.clone();

    tokio::spawn(async move {
        task_mgr
            .send_log(&task_id, format!("Starting backup: {}", backup_name))
            .await;

        let output = TokioCommand::new("tar")
            .arg("-czf")
            .arg(&backup_path)
            .arg("-C")
            .arg(&source_dir)
            .arg(".")
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => {
                task_mgr
                    .send_log(&task_id, "Backup created successfully.".to_string())
                    .await;
                task_mgr
                    .update_status(&task_id, crate::services::tasks::TaskStatus::Completed)
                    .await;
            }
            Ok(out) => {
                let err = String::from_utf8_lossy(&out.stderr).to_string();
                task_mgr
                    .send_log(&task_id, format!("Backup failed: {}", err))
                    .await;
                task_mgr
                    .update_status(&task_id, crate::services::tasks::TaskStatus::Failed(err))
                    .await;
            }
            Err(e) => {
                task_mgr
                    .send_log(&task_id, format!("Backup error: {}", e))
                    .await;
                task_mgr
                    .update_status(
                        &task_id,
                        crate::services::tasks::TaskStatus::Failed(e.to_string()),
                    )
                    .await;
            }
        }
    });

    (
        axum::http::StatusCode::ACCEPTED,
        Json(ApiResponse::ok(TaskResponse { task_id })),
    )
        .into_response()
}

#[utoipa::path(
    summary = "Delete Backup",
    delete,
    path = "/api/v1/servers/{server_id}/backups/{backup_name}",
    params(
        ("server_id" = String, Path, description = "Server ID"),
        ("backup_name" = String, Path, description = "Backup Name")
    ),
    responses(
        (status = 200, description = "Delete backup", body = inline(protocol::ApiResponse<String>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_backup(
    _auth: NodeAuth,
    Path((server_id, backup_name)): Path<(String, String)>,
    State(state): State<AppState>,
) -> Json<ApiResponse<String>> {
    let backup_path = format!(
        "{}/backups/{}/{}",
        state.config.data_dir, server_id, backup_name
    );

    // Prevent directory traversal
    if backup_name.contains('/') || backup_name.contains('\\') || backup_name.contains("..") {
        return Json(ApiResponse::err("Invalid backup name"));
    }

    match tokio::fs::remove_file(&backup_path).await {
        Ok(_) => {
            tracing::info!(server_id = %server_id, backup = %backup_name, "Deleted backup");
            Json(ApiResponse::ok("Backup deleted".to_string()))
        }
        Err(e) => Json(ApiResponse::err(e.to_string())),
    }
}

#[utoipa::path(
    summary = "Restore Backup",
    post,
    path = "/api/v1/servers/{server_id}/backups/{backup_name}/restore",
    params(
        ("server_id" = String, Path, description = "Server ID"),
        ("backup_name" = String, Path, description = "Backup Name")
    ),
    responses(
        (status = 202, description = "Restore backup", body = inline(protocol::ApiResponse<TaskResponse>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn restore_backup(
    _auth: NodeAuth,
    Path((server_id, backup_name)): Path<(String, String)>,
    State(state): State<AppState>,
) -> axum::response::Response {
    let backup_path = format!(
        "{}/backups/{}/{}",
        state.config.data_dir, server_id, backup_name
    );
    let server_dir = format!("{}/{}", state.config.data_dir, server_id);

    // Prevent directory traversal
    if backup_name.contains('/') || backup_name.contains('\\') || backup_name.contains("..") {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            Json(ApiResponse::<()>::err("Invalid backup name")),
        )
            .into_response();
    }

    if !tokio::fs::try_exists(&backup_path).await.unwrap_or(false) {
        return (
            axum::http::StatusCode::NOT_FOUND,
            Json(ApiResponse::<()>::err("Backup not found")),
        )
            .into_response();
    }

    let (task_id, _rx) = state
        .task_mgr
        .create_task(server_id.clone(), "restore_backup".to_string())
        .await;
    let task_mgr = state.task_mgr.clone();
    let docker = state.docker.clone();

    tokio::spawn(async move {
        task_mgr
            .send_log(&task_id, format!("Restoring backup: {}", backup_name))
            .await;

        // Attempt to stop the container before restoring
        let _ = docker
            .power_action(&server_id, protocol::ServerPowerAction::Stop)
            .await;

        // Wait a brief moment to ensure container stops releasing file locks
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        let output = TokioCommand::new("tar")
            .arg("-xzf")
            .arg(&backup_path)
            .arg("-C")
            .arg(&server_dir)
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => {
                // Attempt to restart the container
                let _ = docker
                    .power_action(&server_id, protocol::ServerPowerAction::Start)
                    .await;
                task_mgr
                    .send_log(&task_id, "Backup restored successfully.".to_string())
                    .await;
                task_mgr
                    .update_status(&task_id, crate::services::tasks::TaskStatus::Completed)
                    .await;
            }
            Ok(out) => {
                let err = String::from_utf8_lossy(&out.stderr).to_string();
                task_mgr
                    .send_log(&task_id, format!("Restore failed: {}", err))
                    .await;
                task_mgr
                    .update_status(&task_id, crate::services::tasks::TaskStatus::Failed(err))
                    .await;
            }
            Err(e) => {
                task_mgr
                    .send_log(&task_id, format!("Restore error: {}", e))
                    .await;
                task_mgr
                    .update_status(
                        &task_id,
                        crate::services::tasks::TaskStatus::Failed(e.to_string()),
                    )
                    .await;
            }
        }
    });

    (
        axum::http::StatusCode::ACCEPTED,
        Json(ApiResponse::ok(TaskResponse { task_id })),
    )
        .into_response()
}

#[utoipa::path(
    summary = "Download Backup",
    get,
    path = "/api/v1/servers/{server_id}/backups/{backup_name}/download",
    params(
        ("server_id" = String, Path, description = "Server ID"),
        ("backup_name" = String, Path, description = "Backup Name")
    ),
    responses(
        (status = 200, description = "Download backup stream")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn download_backup(
    _auth: crate::services::auth::NodeAuth,
    axum::extract::Path((server_id, backup_name)): axum::extract::Path<(String, String)>,
    axum::extract::State(state): axum::extract::State<crate::routes::AppState>,
) -> axum::response::Response {
    let backup_path = format!(
        "{}/backups/{}/{}",
        state.config.data_dir, server_id, backup_name
    );

    // Prevent directory traversal
    if backup_name.contains('/') || backup_name.contains('\\') || backup_name.contains("..") {
        return (axum::http::StatusCode::BAD_REQUEST, "Invalid backup name").into_response();
    }

    if let Ok(file) = tokio::fs::File::open(&backup_path).await {
        let stream = tokio_util::io::ReaderStream::new(file);
        let body = axum::body::Body::from_stream(stream);
        let headers = [
            (
                axum::http::header::CONTENT_TYPE,
                "application/gzip".to_string(),
            ),
            (
                axum::http::header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{}\"", backup_name),
            ),
        ];
        (headers, body).into_response()
    } else {
        (axum::http::StatusCode::NOT_FOUND, "Backup not found").into_response()
    }
}
