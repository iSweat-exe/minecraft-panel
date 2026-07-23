use super::sanitize_path;
use anyhow::{bail, Context, Result};
use protocol::FileAction;

pub async fn perform_action(path: &str, action: FileAction) -> Result<()> {
    let path = sanitize_path(path)?;
    match action {
        FileAction::Rename { new_name } => {
            let new_path = sanitize_path(&new_name)?;
            tokio::fs::rename(path, new_path)
                .await
                .context("Failed to rename file")?;
        }
        FileAction::Copy { destination } => {
            let dest_path = sanitize_path(&destination)?;
            tokio::fs::copy(path, dest_path)
                .await
                .context("Failed to copy file")?;
        }
        FileAction::Delete => {
            if path.exists() {
                if path.is_dir() {
                    tokio::fs::remove_dir_all(path)
                        .await
                        .context("Failed to delete directory")?;
                } else {
                    tokio::fs::remove_file(path)
                        .await
                        .context("Failed to delete file")?;
                }
            }
        }
        FileAction::Mkdir => {
            tokio::fs::create_dir_all(path)
                .await
                .context("Failed to create directory")?;
        }
        FileAction::Archive { archive_name } => {
            let archive_path = sanitize_path(&archive_name)?;
            let filename = path
                .file_name()
                .ok_or_else(|| anyhow::anyhow!("Invalid target path"))?;
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
