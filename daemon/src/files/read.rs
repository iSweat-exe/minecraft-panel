use anyhow::{bail, Context, Result};
use std::path::Path;

pub async fn read_file(path: &Path) -> Result<Vec<u8>> {
    if !path.is_file() {
        bail!("Path is not a file");
    }
    let data = tokio::fs::read(path)
        .await
        .context("Failed to read file contents")?;
    Ok(data)
}
