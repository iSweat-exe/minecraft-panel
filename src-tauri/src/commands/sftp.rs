use crate::error::AppError;
use crate::state::SshState;
use serde::Serialize;
use tauri::State;
use russh_sftp::client::SftpSession;
use russh_sftp::protocol::OpenFlags;
use tokio::io::AsyncWriteExt;
use std::sync::Arc;

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
}

fn sanitize_path(path: &str) -> Result<String, AppError> {
    // Basic path traversal prevention
    if path.contains("..") {
        return Err(AppError::Message("Path traversal détecté et bloqué.".to_string()));
    }
    Ok(path.to_string())
}

async fn get_sftp_session(state: &SshState) -> Result<Arc<SftpSession>, AppError> {
    let mut sftp_lock = state.sftp.lock().await;
    if let Some(sftp) = sftp_lock.as_ref() {
        return Ok(sftp.clone());
    }

    let session_lock = state.session.lock().await;
    let session = session_lock.as_ref().ok_or_else(|| AppError::Message("Not connected".into()))?;

    let channel = session.channel_open_session().await.map_err(|e| AppError::Message(e.to_string()))?;
    channel.request_subsystem(true, "sftp").await.map_err(|e| AppError::Message(e.to_string()))?;
    
    let sftp = SftpSession::new(channel.into_stream()).await.map_err(|e| AppError::Message(e.to_string()))?;
    let sftp_arc = Arc::new(sftp);
    *sftp_lock = Some(sftp_arc.clone());
    
    Ok(sftp_arc)
}

#[tauri::command]
pub async fn sftp_list_dir(state: State<'_, SshState>, path: String) -> Result<Vec<FileEntry>, AppError> {
    let path = sanitize_path(&path)?;
    let sftp = get_sftp_session(&state).await?;
    let mut entries = Vec::new();
    
    let mut read_dir = sftp.read_dir(path).await.map_err(|e| AppError::Message(e.to_string()))?;
    
    while let Some(entry) = read_dir.next() {
        let name = entry.file_name();
        if name == "." || name == ".." { continue; }
        
        let meta = entry.metadata();
        entries.push(FileEntry {
            name,
            is_dir: meta.is_dir(),
            size: meta.size.unwrap_or(0),
            modified: meta.mtime.unwrap_or(0) as u64,
        });
    }
    
    // Sort directories first, then alphabetical
    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name))
    });
    
    Ok(entries)
}

#[tauri::command]
pub async fn sftp_read_file(state: State<'_, SshState>, path: String) -> Result<String, AppError> {
    let path = sanitize_path(&path)?;
    let sftp = get_sftp_session(&state).await?;
    let bytes = sftp.read(path).await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
pub async fn sftp_write_file(state: State<'_, SshState>, path: String, content: String) -> Result<(), AppError> {
    let path = sanitize_path(&path)?;
    let sftp = get_sftp_session(&state).await?;
    let mut file = sftp.open_with_flags(path, OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::TRUNCATE).await.map_err(|e| AppError::Message(e.to_string()))?;
    file.write_all(content.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(())
}

use std::pin::Pin;
use std::future::Future;

fn remove_recursive<'a>(sftp: Arc<SftpSession>, path: String) -> Pin<Box<dyn Future<Output = Result<(), AppError>> + Send + 'a>> {
    Box::pin(async move {
        // Try to read_dir first. If it succeeds, it's a directory.
        let is_dir = match sftp.read_dir(path.clone()).await {
            Ok(mut read_dir) => {
                while let Some(entry) = read_dir.next() {
                    let name = entry.file_name();
                    if name == "." || name == ".." { continue; }
                    let child_path = format!("{}/{}", path, name);
                    remove_recursive(sftp.clone(), child_path).await?;
                }
                true
            }
            Err(_) => false,
        };

        if is_dir {
            sftp.remove_dir(path).await.map_err(|e| AppError::Message(e.to_string()))?;
        } else {
            sftp.remove_file(path).await.map_err(|e| AppError::Message(e.to_string()))?;
        }
        
        Ok(())
    })
}

#[tauri::command]
pub async fn sftp_delete(state: State<'_, SshState>, path: String, _is_dir: bool) -> Result<(), AppError> {
    let path = sanitize_path(&path)?;
    let sftp = get_sftp_session(&state).await?;
    remove_recursive(sftp, path).await?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_rename(state: State<'_, SshState>, old_path: String, new_path: String) -> Result<(), AppError> {
    let old_path = sanitize_path(&old_path)?;
    let new_path = sanitize_path(&new_path)?;
    let sftp = get_sftp_session(&state).await?;
    sftp.rename(old_path, new_path).await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_mkdir(state: State<'_, SshState>, path: String) -> Result<(), AppError> {
    let path = sanitize_path(&path)?;
    let sftp = get_sftp_session(&state).await?;
    sftp.create_dir(path).await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn ssh_copy(state: State<'_, SshState>, src: String, dest: String) -> Result<(), AppError> {
    let src = sanitize_path(&src)?;
    let dest = sanitize_path(&dest)?;
    let session_lock = state.session.lock().await;
    let session = session_lock.as_ref().ok_or_else(|| AppError::Message("Not connected".into()))?;

    let mut channel = session.channel_open_session().await.map_err(|e| AppError::Message(e.to_string()))?;
    
    // Safely quote paths
    let src_quoted = format!("'{}'", src.replace("'", "'\\''"));
    let dest_quoted = format!("'{}'", dest.replace("'", "'\\''"));
    let cmd = format!("cp -r {} {}", src_quoted, dest_quoted);
    
    channel.exec(true, cmd.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;

    // Verify exit status
    let mut exit_status = None;
    while let Some(msg) = channel.wait().await {
        match msg {
            russh::ChannelMsg::ExitStatus { exit_status: s } => {
                exit_status = Some(s);
            }
            russh::ChannelMsg::Close => {
                break;
            }
            _ => {}
        }
    }

    if let Some(status) = exit_status {
        if status != 0 {
            return Err(AppError::Message(format!("Command failed with status {}", status)));
        }
    } else {
        return Err(AppError::Message("Command did not return an exit status".to_string()));
    }

    Ok(())
}

#[tauri::command]
pub async fn sftp_upload_file(
    app: tauri::AppHandle,
    state: State<'_, SshState>,
    local_path: String,
    remote_path: String,
) -> Result<(), AppError> {
    use tauri::Emitter;
    use tokio::io::AsyncReadExt;

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

    use sha2::{Sha256, Digest};
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
            #[derive(serde::Serialize, Clone)]
            struct UploadProgress {
                filename: String,
                written: u64,
                total: u64,
            }

            let _ = app.emit(
                "upload-progress",
                UploadProgress {
                    filename: filename.clone(),
                    written,
                    total,
                },
            );
            last_emit = std::time::Instant::now();
        }
    }

    // Final emit to guarantee 100%
    #[derive(serde::Serialize, Clone)]
    struct FinalUploadProgress {
        filename: String,
        written: u64,
        total: u64,
    }
    let _ = app.emit(
        "upload-progress",
        FinalUploadProgress {
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

#[tauri::command]
pub async fn sftp_read_file_base64(state: State<'_, SshState>, path: String) -> Result<String, AppError> {
    let path = sanitize_path(&path)?;
    let sftp = get_sftp_session(&state).await?;
    let bytes = sftp.read(path).await.map_err(|e| AppError::Message(e.to_string()))?;
    
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    Ok(STANDARD.encode(&bytes))
}

#[tauri::command]
pub async fn cancel_backup(state: State<'_, SshState>) -> Result<(), AppError> {
    state.backup_cancel.store(true, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn sftp_download_file(
    app: tauri::AppHandle,
    state: State<'_, SshState>,
    remote_path: String,
    local_path: String,
) -> Result<(), AppError> {
    use tauri::Emitter;
    use tokio::io::AsyncWriteExt;

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

    let remote_path_quoted = format!("'{}'", remote_path.replace("'", "'\\''"));
    let cmd = format!("cat {}", remote_path_quoted);
    
    channel.exec(true, cmd.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;

    let mut local_file = tokio::fs::File::create(&local_path)
        .await
        .map_err(|e| AppError::Message(format!("Local create failed: {}", e)))?;

    let mut written: u64 = 0;

    use sha2::{Sha256, Digest};
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
                    #[derive(serde::Serialize, Clone)]
                    struct DownloadProgress {
                        filename: String,
                        written: u64,
                        total: u64,
                    }

                    let _ = app.emit(
                        "download-progress",
                        DownloadProgress {
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
    #[derive(serde::Serialize, Clone)]
    struct FinalDownloadProgress {
        filename: String,
        written: u64,
        total: u64,
    }
    let _ = app.emit(
        "download-progress",
        FinalDownloadProgress {
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
