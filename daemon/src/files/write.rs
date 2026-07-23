use super::sanitize_path;
use anyhow::{Context, Result};

pub async fn write_file(path: &str, content: &[u8]) -> Result<()> {
    let path = sanitize_path(path)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .context("Failed to create parent directories")?;
    }
    tokio::fs::write(path, content)
        .await
        .context("Failed to write to file")?;
    Ok(())
}
