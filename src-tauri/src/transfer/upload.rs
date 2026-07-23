use crate::error::AppError;
use crate::state::SshState;
use crate::models::TransferProgress;
use crate::commands::sftp::sanitize_path;
use tauri::State;
use tauri::Emitter;
use tokio::io::AsyncReadExt;
use sha2::{Sha256, Digest};
use std::path::Path;

#[tauri::command]
pub async fn sftp_upload_file(
    app: tauri::AppHandle,
    state: State<'_, SshState>,
    local_path: String,
    remote_path: String,
) -> Result<(), AppError> {
    state.backup_cancel.store(false, std::sync::atomic::Ordering::Relaxed);

    let meta = tokio::fs::metadata(&local_path)
        .await
        .map_err(|e| AppError::Message(format!("Local read failed: {}", e)))?;

    if meta.is_dir() {
        if let Ok(()) = upload_dir_archive_fast(&app, &state, &local_path, &remote_path).await {
            return Ok(());
        }
        // Fallback to recursive upload if tar is unavailable locally
        Box::pin(upload_dir_recursive(&app, &state, &local_path, &remote_path)).await
    } else {
        let filename = Path::new(&local_path)
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());
        upload_single_file_internal(&app, &state, &local_path, &remote_path, &filename).await
    }
}

async fn upload_dir_archive_fast(
    app: &tauri::AppHandle,
    state: &State<'_, SshState>,
    local_dir: &str,
    remote_dir: &str,
) -> Result<(), AppError> {
    let local_path = Path::new(local_dir);
    let parent_dir = local_path.parent().ok_or_else(|| AppError::Message("Invalid local path".into()))?;
    let folder_name = local_path.file_name().ok_or_else(|| AppError::Message("Invalid folder name".into()))?.to_string_lossy().to_string();

    let temp_dir = std::env::temp_dir();
    let temp_tar_filename = format!("panel_up_{}.tar.gz", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis());
    let temp_tar_path = temp_dir.join(&temp_tar_filename).to_string_lossy().to_string();

    // 1. Create local .tar.gz archive
    let local_tar_path = temp_tar_path.clone();
    let parent_dir_buf = parent_dir.to_path_buf();
    let folder_name_buf = folder_name.clone();

    let output = tokio::task::spawn_blocking(move || {
        std::process::Command::new("tar")
            .arg("-czf")
            .arg(&local_tar_path)
            .arg("-C")
            .arg(&parent_dir_buf)
            .arg(&folder_name_buf)
            .output()
    })
    .await
    .map_err(|e| AppError::Message(format!("Task spawn failed: {}", e)))?
    .map_err(|e| AppError::Message(format!("Local tar failed: {}", e)))?;

    if !output.status.success() {
        let _ = tokio::fs::remove_file(&temp_tar_path).await;
        return Err(AppError::Message("Local tar command failed".into()));
    }

    let remote_dir_sanitized = sanitize_path(remote_dir)?;
    let remote_temp_tar = format!("/tmp/{}", temp_tar_filename);

    // 2. Upload single archive file to /tmp/ with progress events under folder_name
    let upload_res = upload_single_file_internal(app, state, &temp_tar_path, &remote_temp_tar, &folder_name).await;

    // Clean up local temp file
    let _ = tokio::fs::remove_file(&temp_tar_path).await;

    upload_res?;

    // 3. Extract remote archive on VPS
    let session_lock = state.session.lock().await;
    let session = session_lock.as_ref().ok_or_else(|| AppError::Message("Not connected".into()))?;
    let mut ch = session.channel_open_session().await.map_err(|e| AppError::Message(e.to_string()))?;

    let remote_dir_quoted = format!("'{}'", remote_dir_sanitized.replace("'", "'\\''"));
    let remote_tar_quoted = format!("'{}'", remote_temp_tar.replace("'", "'\\''"));

    let extract_cmd = format!(
        "mkdir -p {0} && tar -xzf {1} -C {0} --strip-components=1 && rm -f {1}",
        remote_dir_quoted, remote_tar_quoted
    );

    ch.exec(true, extract_cmd.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;
    ch.eof().await.ok();

    while let Some(msg) = ch.wait().await {
        if let russh::ChannelMsg::Close = msg {
            break;
        }
    }

    Ok(())
}

async fn upload_dir_recursive(
    app: &tauri::AppHandle,
    state: &State<'_, SshState>,
    local_dir: &str,
    remote_dir: &str,
) -> Result<(), AppError> {
    let remote_dir_sanitized = sanitize_path(remote_dir)?;
    
    // Create remote folder on VPS
    {
        let session_lock = state.session.lock().await;
        let session = session_lock.as_ref().ok_or_else(|| AppError::Message("Not connected".into()))?;
        let ch = session.channel_open_session().await.map_err(|e| AppError::Message(e.to_string()))?;
        let mkdir_cmd = format!("mkdir -p '{}'", remote_dir_sanitized.replace("'", "'\\''"));
        ch.exec(true, mkdir_cmd.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;
        ch.eof().await.ok();
    }

    let mut entries = tokio::fs::read_dir(local_dir)
        .await
        .map_err(|e| AppError::Message(format!("Impossible de lire le dossier local {}: {}", local_dir, e)))?;

    while let Some(entry) = entries.next_entry().await.map_err(|e| AppError::Message(e.to_string()))? {
        if state.backup_cancel.load(std::sync::atomic::Ordering::Relaxed) {
            return Err(AppError::Message("Annulé par l'utilisateur".to_string()));
        }

        let child_local_path = entry.path().to_string_lossy().to_string();
        let file_name = entry.file_name().to_string_lossy().to_string();
        let child_remote_path = format!("{}/{}", remote_dir_sanitized.trim_end_matches('/'), file_name);

        let child_meta = entry.metadata().await.map_err(|e| AppError::Message(e.to_string()))?;
        if child_meta.is_dir() {
            Box::pin(upload_dir_recursive(app, state, &child_local_path, &child_remote_path)).await?;
        } else {
            upload_single_file_internal(app, state, &child_local_path, &child_remote_path, &file_name).await?;
        }
    }

    Ok(())
}

async fn upload_single_file_internal(
    app: &tauri::AppHandle,
    state: &State<'_, SshState>,
    local_path: &str,
    remote_path: &str,
    display_name: &str,
) -> Result<(), AppError> {
    // Open local file
    let mut local_file = tokio::fs::File::open(local_path)
        .await
        .map_err(|e| AppError::Message(format!("Local read failed: {}", e)))?;

    let total = local_file.metadata().await.map(|m| m.len()).unwrap_or(0);
    let remote_path = sanitize_path(remote_path)?;
    let session_lock = state.session.lock().await;
    let session = session_lock.as_ref().ok_or_else(|| AppError::Message("Not connected".into()))?;
    
    let mut channel = session.channel_open_session().await.map_err(|e| AppError::Message(e.to_string()))?;
    let remote_path_quoted = format!("'{}'", remote_path.replace("'", "'\\''"));
    let cmd = format!("cat > {}", remote_path_quoted);
    
    channel.exec(true, cmd.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;

    let mut buffer = vec![0u8; 1024 * 1024]; // 1MB chunks
    let mut written: u64 = 0;
    let mut hasher = Sha256::new();
    let mut last_emit = std::time::Instant::now();

    loop {
        if state.backup_cancel.load(std::sync::atomic::Ordering::Relaxed) {
            let _ = channel.eof().await;
            return Err(AppError::Message("Annulé par l'utilisateur".to_string()));
        }

        let n = local_file.read(&mut buffer).await.map_err(|e| AppError::Message(e.to_string()))?;
        if n == 0 {
            break; // EOF
        }

        hasher.update(&buffer[..n]);
        channel.data(&buffer[..n]).await.map_err(|e| AppError::Message(e.to_string()))?;
        written += n as u64;

        if last_emit.elapsed().as_millis() > 125 {
            let _ = app.emit(
                "upload-progress",
                TransferProgress {
                    filename: display_name.to_string(),
                    written,
                    total,
                },
            );
            last_emit = std::time::Instant::now();
        }
    }

    let _ = app.emit(
        "upload-progress",
        TransferProgress {
            filename: display_name.to_string(),
            written,
            total,
        },
    );

    channel.eof().await.map_err(|e| AppError::Message(e.to_string()))?;
    
    while let Some(msg) = channel.wait().await {
        if let russh::ChannelMsg::Close = msg {
            break;
        }
    }

    let hash = hasher.finalize();
    let local_hash = hash.iter().map(|b| format!("{:02x}", b)).collect::<String>();

    // Verify remote hash
    let mut check_channel = session.channel_open_session().await.map_err(|e| AppError::Message(e.to_string()))?;
    let check_cmd = format!("sha256sum {}", remote_path_quoted);
    check_channel.exec(true, check_cmd.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;

    let mut remote_hash_output = String::new();
    while let Some(msg) = check_channel.wait().await {
        if let russh::ChannelMsg::Data { ref data } = msg {
            remote_hash_output.push_str(&String::from_utf8_lossy(data));
        } else if let russh::ChannelMsg::Close = msg {
            break;
        }
    }

    let remote_hash = remote_hash_output.split_whitespace().next().unwrap_or("");
    if local_hash != remote_hash {
        return Err(AppError::Message("La vérification de l'intégrité (SHA256) a échoué. Le fichier est potentiellement corrompu.".to_string()));
    }

    Ok(())
}
