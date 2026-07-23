use crate::error::AppError;
use crate::state::SshState;
use crate::models::TransferProgress;
use crate::commands::sftp::sanitize_path;
use tauri::State;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;
use sha2::{Sha256, Digest};

#[tauri::command]
pub async fn sftp_download_file(
    app: tauri::AppHandle,
    state: State<'_, SshState>,
    remote_path: String,
    local_path: String,
) -> Result<(), AppError> {
    state.backup_cancel.store(false, std::sync::atomic::Ordering::Relaxed);
    let remote_path = sanitize_path(&remote_path)?;

    let session_lock = state.session.lock().await;
    let session = session_lock.as_ref().ok_or_else(|| AppError::Message("Not connected".into()))?;

    // Reliably get file size via SSH stat command
    let mut size_channel = session.channel_open_session().await.map_err(|e| AppError::Message(e.to_string()))?;
    let remote_path_quoted = format!("'{}'", remote_path.replace("'", "'\\''"));
    let size_cmd = format!("stat -c%s {}", remote_path_quoted);
    
    size_channel.exec(true, size_cmd.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;
    
    let mut size_output = String::new();
    while let Some(msg) = size_channel.wait().await {
        if let russh::ChannelMsg::Data { ref data } = msg {
            size_output.push_str(&String::from_utf8_lossy(data));
        } else if let russh::ChannelMsg::Close = msg {
            break;
        }
    }
    
    let total = size_output.trim().parse::<u64>().unwrap_or(0);

    let filename = remote_path
        .replace('\\', "/")
        .rsplit('/')
        .next()
        .unwrap_or("unknown")
        .to_string();

    let mut channel = session.channel_open_session().await.map_err(|e| AppError::Message(e.to_string()))?;

    let cmd = format!("cat {}", remote_path_quoted);
    
    channel.exec(true, cmd.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;

    let mut local_file = tokio::fs::File::create(&local_path)
        .await
        .map_err(|e| AppError::Message(format!("Local create failed: {}", e)))?;

    let mut written: u64 = 0;

    let mut hasher = Sha256::new();
    let mut last_emit = std::time::Instant::now();

    while let Some(msg) = channel.wait().await {
        if state.backup_cancel.load(std::sync::atomic::Ordering::Relaxed) {
            let _ = tokio::fs::remove_file(&local_path).await;
            return Err(AppError::Message("Annulé par l'utilisateur".to_string()));
        }

        match msg {
            russh::ChannelMsg::Data { ref data } => {
                hasher.update(data);
                local_file.write_all(data).await.map_err(|e| AppError::Message(e.to_string()))?;
                written += data.len() as u64;

                if last_emit.elapsed().as_millis() > 125 {
                    let _ = app.emit(
                        "download-progress",
                        TransferProgress {
                            filename: filename.clone(),
                            written,
                            total,
                        },
                    );
                    last_emit = std::time::Instant::now();
                }
            }
            russh::ChannelMsg::Eof => {
                break;
            }
            russh::ChannelMsg::Close => {
                break;
            }
            _ => {}
        }
    }

    // Final emit to guarantee 100%
    let _ = app.emit(
        "download-progress",
        TransferProgress {
            filename: filename.clone(),
            written,
            total,
        },
    );

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
        let _ = tokio::fs::remove_file(&local_path).await;
        return Err(AppError::Message("La vérification de l'intégrité (SHA256) a échoué. Le fichier est potentiellement corrompu.".to_string()));
    }

    Ok(())
}
