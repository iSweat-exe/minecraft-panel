use crate::error::AppError;
use crate::state::SshState;
use crate::models::TransferProgress;
use crate::commands::sftp::sanitize_path;
use tauri::State;
use tauri::Emitter;
use tokio::io::AsyncReadExt;
use sha2::{Sha256, Digest};

#[tauri::command]
pub async fn sftp_upload_file(
    app: tauri::AppHandle,
    state: State<'_, SshState>,
    local_path: String,
    remote_path: String,
) -> Result<(), AppError> {
    state.backup_cancel.store(false, std::sync::atomic::Ordering::Relaxed);

    // Open local file
    let mut local_file = tokio::fs::File::open(&local_path)
        .await
        .map_err(|e| AppError::Message(format!("Local read failed: {}", e)))?;

    let total = local_file.metadata().await.map(|m| m.len()).unwrap_or(0);
    let filename = local_path
        .replace('\\', "/")
        .rsplit('/')
        .next()
        .unwrap_or("unknown")
        .to_string();

    let remote_path = sanitize_path(&remote_path)?;
    // Open SSH channel instead of SFTP
    let session_lock = state.session.lock().await;
    let session = session_lock.as_ref().ok_or_else(|| AppError::Message("Not connected".into()))?;
    
    let mut channel = session.channel_open_session().await.map_err(|e| AppError::Message(e.to_string()))?;

    let remote_path_quoted = format!("'{}'", remote_path.replace("'", "'\\''"));
    let cmd = format!("cat > {}", remote_path_quoted);
    
    channel.exec(true, cmd.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;

    // Read in chunks and send over SSH channel
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
                    filename: filename.clone(),
                    written,
                    total,
                },
            );
            last_emit = std::time::Instant::now();
        }
    }

    // Final emit to guarantee 100%
    let _ = app.emit(
        "upload-progress",
        TransferProgress {
            filename: filename.clone(),
            written,
            total,
        },
    );

    channel.eof().await.map_err(|e| AppError::Message(e.to_string()))?;
    
    // Wait for channel close to ensure remote process flushed
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
