use super::sanitize_path;
use anyhow::{bail, Context, Result};
use sha1::{Digest, Sha1};

pub async fn hash_file(path: &str) -> Result<String> {
    let path = sanitize_path(path)?;
    if !path.is_file() {
        bail!("Path is not a file");
    }
    let data = tokio::fs::read(path)
        .await
        .context("Failed to read file for hashing")?;
    let mut hasher = Sha1::new();
    hasher.update(&data);
    let result = hasher.finalize();
    Ok(format!("{:x}", result))
}
