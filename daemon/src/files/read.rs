use super::sanitize_path;
use anyhow::{bail, Context, Result};

pub async fn read_file(path: &str) -> Result<Vec<u8>> {
    let path = sanitize_path(path)?;
    if !path.is_file() {
        bail!("Path is not a file");
    }
    let data = tokio::fs::read(path)
        .await
        .context("Failed to read file contents")?;
    Ok(data)
}
