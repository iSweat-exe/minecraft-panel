use crate::error::AppError;
use crate::state::SshState;

use tauri::State;
use russh_sftp::client::SftpSession;
use russh_sftp::protocol::OpenFlags;
use tokio::io::AsyncWriteExt;
use std::sync::Arc;

use crate::models::FileEntry;

pub fn sanitize_path(path: &str) -> Result<String, AppError> {
    // Basic path traversal prevention
    if path.contains("..") {
        return Err(AppError::Message("Path traversal détecté et bloqué.".to_string()));
    }
    Ok(path.to_string())
}

pub(crate) async fn get_sftp_session(state: &SshState) -> Result<Arc<SftpSession>, AppError> {
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
pub async fn sftp_read_file_base64(state: State<'_, SshState>, path: String) -> Result<String, AppError> {
    let path = sanitize_path(&path)?;
    let sftp = get_sftp_session(&state).await?;
    let bytes = sftp.read(path).await.map_err(|e| AppError::Message(e.to_string()))?;
    
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    Ok(STANDARD.encode(&bytes))
}

#[tauri::command]
pub async fn ssh_download_remote(state: State<'_, SshState>, url: String, dest: String) -> Result<(), AppError> {
    let dest = sanitize_path(&dest)?;
    let session_lock = state.session.lock().await;
    let session = session_lock.as_ref().ok_or_else(|| AppError::Message("Not connected".into()))?;

    let mut channel = session.channel_open_session().await.map_err(|e| AppError::Message(e.to_string()))?;
    
    let url_quoted = format!("'{}'", url.replace("'", "'\\''"));
    let dest_quoted = format!("'{}'", dest.replace("'", "'\\''"));
    
    // Try wget, fallback to curl if not available
    let cmd = format!("wget -q -O {0} {1} || curl -sLo {0} {1}", dest_quoted, url_quoted);
    
    channel.exec(true, cmd.as_bytes()).await.map_err(|e| AppError::Message(e.to_string()))?;

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
            return Err(AppError::Message(format!("Download failed with status {}", status)));
        }
    } else {
        return Err(AppError::Message("Command did not return an exit status".to_string()));
    }

    Ok(())
}
