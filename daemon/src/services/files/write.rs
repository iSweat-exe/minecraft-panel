use anyhow::{Context, Result};
use std::path::Path;

pub async fn write_file(path: &Path, content: &[u8]) -> Result<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .context("Failed to create parent directories")?;
    }
    tokio::fs::write(&path, content)
        .await
        .context("Failed to write to file")?;

    if let Some(parent) = path.parent() {
        crate::services::files::fix_permissions_for(path, parent).ok();
    }

    Ok(())
}
