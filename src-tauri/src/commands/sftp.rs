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
    let sftp = get_sftp_session(&state).await?;
    let bytes = sftp.read(path).await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
pub async fn sftp_write_file(state: State<'_, SshState>, path: String, content: String) -> Result<(), AppError> {
    let sftp = get_sftp_session(&state).await?;
    let mut file = sftp.open_with_flags(path, OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::TRUNCATE).await.map_err(|e| AppError::Message(e.to_string()))?;
    file.write_all(content.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_delete(state: State<'_, SshState>, path: String, _is_dir: bool) -> Result<(), AppError> {
    let session_lock = state.session.lock().await;
    let session = session_lock.as_ref().ok_or_else(|| AppError::Message("Not connected".into()))?;

    let channel = session.channel_open_session().await.map_err(|e| AppError::Message(e.to_string()))?;
    
    let path_quoted = format!("'{}'", path.replace("'", "'\\''"));
    let cmd = format!("rm -rf {}", path_quoted);
    
    channel.exec(true, cmd.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_rename(state: State<'_, SshState>, old_path: String, new_path: String) -> Result<(), AppError> {
    let sftp = get_sftp_session(&state).await?;
    sftp.rename(old_path, new_path).await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn sftp_mkdir(state: State<'_, SshState>, path: String) -> Result<(), AppError> {
    let sftp = get_sftp_session(&state).await?;
    sftp.create_dir(path).await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn ssh_copy(state: State<'_, SshState>, src: String, dest: String) -> Result<(), AppError> {
    let session_lock = state.session.lock().await;
    let session = session_lock.as_ref().ok_or_else(|| AppError::Message("Not connected".into()))?;

    let channel = session.channel_open_session().await.map_err(|e| AppError::Message(e.to_string()))?;
    
    // Safely quote paths
    let src_quoted = format!("'{}'", src.replace("'", "'\\''"));
    let dest_quoted = format!("'{}'", dest.replace("'", "'\\''"));
    let cmd = format!("cp -r {} {}", src_quoted, dest_quoted);
    
    channel.exec(true, cmd.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;
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

    let sftp = get_sftp_session(&state).await?;

    // Read the full file locally
    let content = tokio::fs::read(&local_path)
        .await
        .map_err(|e| AppError::Message(format!("Local read failed: {}", e)))?;

    let total = content.len() as u64;
    let filename = local_path
        .replace('\\', "/")
        .rsplit('/')
        .next()
        .unwrap_or("unknown")
        .to_string();

    // Open remote file
    let mut file = sftp
        .open_with_flags(&remote_path, OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::TRUNCATE)
        .await
        .map_err(|e| AppError::Message(e.to_string()))?;

    // Write in 64 KB chunks, emitting progress events
    let chunk_size = 64 * 1024;
    let mut written: u64 = 0;

    for chunk in content.chunks(chunk_size) {
        file.write_all(chunk)
            .await
            .map_err(|e| AppError::Message(e.to_string()))?;
        written += chunk.len() as u64;

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
    }

    Ok(())
}

#[tauri::command]
pub async fn sftp_read_file_base64(state: State<'_, SshState>, path: String) -> Result<String, AppError> {
    let sftp = get_sftp_session(&state).await?;
    let bytes = sftp.read(path).await.map_err(|e| AppError::Message(e.to_string()))?;
    
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    Ok(STANDARD.encode(&bytes))
}
