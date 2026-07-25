use anyhow::{bail, Context, Result};
use protocol::FileAction;
use std::path::Path;

pub async fn perform_action(path: &Path, action: FileAction, data_dir: &str, server_id: &str) -> Result<()> {
    match action {
        FileAction::Rename { new_name } => {
            let new_path = crate::files::sanitize_path(server_id, data_dir, &new_name)?;
            tokio::fs::rename(path, new_path)
                .await
                .context("Failed to rename file")?;
        }
        FileAction::Copy { destination } => {
            let dest_path = crate::files::sanitize_path(server_id, data_dir, &destination)?;
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
            tokio::fs::create_dir_all(&path)
                .await
                .context("Failed to create directory")?;
                
            if let Some(parent) = path.parent() {
                crate::files::fix_permissions_for(&path, parent).ok();
            }
        }
        FileAction::Archive { archive_name, targets } => {
            let archive_path = crate::files::sanitize_path(server_id, data_dir, &archive_name)?;
            
            let mut cmd = tokio::process::Command::new("tar");
            cmd.arg("-czf").arg(&archive_path);

            if let Some(targets) = targets {
                // If targets are provided, `path` is the working directory
                cmd.current_dir(&path);
                for target in targets {
                    cmd.arg(target);
                }
            } else {
                // Legacy behavior: `path` is the target to archive
                let filename = path
                    .file_name()
                    .ok_or_else(|| anyhow::anyhow!("Invalid target path"))?;
                let target_parent = path.parent().unwrap_or(std::path::Path::new(""));
                cmd.current_dir(target_parent);
                cmd.arg(filename);
            }

            let output = cmd.output().await?;
            if !output.status.success() {
                let err_msg = String::from_utf8_lossy(&output.stderr);
                bail!("Failed to create archive: {}", err_msg.trim());
            }
        }
        FileAction::Extract => {
            let parent = path.parent().unwrap_or(std::path::Path::new(""));
            let mut cmd = tokio::process::Command::new("tar");
            cmd.current_dir(parent).arg("-xzf").arg(&path);
            
            let status = cmd.status().await?;

            if !status.success() {
                bail!("Failed to extract archive");
            }
            
            // Fix permissions so they match the server folder owner
            crate::files::fix_permissions_for(parent, parent).ok();
        }
    }
    Ok(())
}
