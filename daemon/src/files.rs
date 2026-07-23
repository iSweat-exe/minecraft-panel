use std::path::PathBuf;
use anyhow::{Result, bail};
use protocol::{FileEntry, FileAction};

fn sanitize_path(path_str: &str) -> Result<PathBuf> {
    let path = PathBuf::from(path_str);
    // Simple traversal check for basic security
    if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        bail!("Path traversal is not allowed");
    }
    Ok(path)
}

pub async fn list_dir(path: &str) -> Result<Vec<FileEntry>> {
    let path = sanitize_path(path)?;
    let mut entries = Vec::new();
    
    if !path.is_dir() {
        bail!("Path is not a directory");
    }

    let mut read_dir = tokio::fs::read_dir(path).await?;
    while let Some(entry) = read_dir.next_entry().await? {
        let meta = entry.metadata().await?;
        let name = entry.file_name().to_string_lossy().to_string();
        
        let modified = meta.modified()
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        entries.push(FileEntry {
            name,
            is_dir: meta.is_dir(),
            size: meta.len(),
            modified,
        });
    }

    // Sort: directories first, then alphabetical
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(entries)
}

pub async fn read_file(path: &str) -> Result<Vec<u8>> {
    let path = sanitize_path(path)?;
    if !path.is_file() {
        bail!("Path is not a file");
    }
    let data = tokio::fs::read(path).await?;
    Ok(data)
}

pub async fn write_file(path: &str, content: &[u8]) -> Result<()> {
    let path = sanitize_path(path)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(path, content).await?;
    Ok(())
}

pub async fn perform_action(path: &str, action: FileAction) -> Result<()> {
    let path = sanitize_path(path)?;
    match action {
        FileAction::Rename { new_name } => {
            let new_path = sanitize_path(&new_name)?;
            tokio::fs::rename(path, new_path).await?;
        }
        FileAction::Copy { destination } => {
            let dest_path = sanitize_path(&destination)?;
            tokio::fs::copy(path, dest_path).await?;
        }
        FileAction::Delete => {
            if path.exists() {
                if path.is_dir() {
                    tokio::fs::remove_dir_all(path).await?;
                } else {
                    tokio::fs::remove_file(path).await?;
                }
            }
        }
        FileAction::Mkdir => {
            tokio::fs::create_dir_all(path).await?;
        }
        FileAction::Archive { archive_name } => {
            let archive_path = sanitize_path(&archive_name)?;
            let parent = archive_path.parent().unwrap_or(std::path::Path::new(""));
            let filename = path.file_name().ok_or_else(|| anyhow::anyhow!("Invalid target path"))?;
            let target_parent = path.parent().unwrap_or(std::path::Path::new(""));
            
            let status = std::process::Command::new("tar")
                .current_dir(target_parent)
                .arg("-czf")
                .arg(&archive_path)
                .arg(filename)
                .status()?;
                
            if !status.success() {
                bail!("Failed to create archive");
            }
        }
        FileAction::Extract => {
            let parent = path.parent().unwrap_or(std::path::Path::new(""));
            let status = std::process::Command::new("tar")
                .current_dir(parent)
                .arg("-xzf")
                .arg(&path)
                .status()?;
                
            if !status.success() {
                bail!("Failed to extract archive");
            }
        }
    }
    Ok(())
}
