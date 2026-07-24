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

fn matches_pattern(filename: &str, patterns: &[String]) -> bool {
    if patterns.is_empty() {
        return true;
    }
    for p in patterns {
        if p.starts_with("*.") {
            let ext = &p[1..];
            if filename.ends_with(ext) {
                return true;
            }
        } else if filename == p {
            return true;
        }
    }
    false
}

pub async fn hash_multiple_files(
    dir_path: &str,
    patterns: &[String],
) -> Result<std::collections::HashMap<String, String>> {
    let path = sanitize_path(dir_path)?;
    if !path.is_dir() {
        bail!("Path is not a directory");
    }

    let mut hashes = std::collections::HashMap::new();
    let mut entries = tokio::fs::read_dir(path)
        .await
        .context("Failed to read directory")?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .context("Failed to get directory entry")?
    {
        let metadata = entry.metadata().await.context("Failed to get metadata")?;
        if !metadata.is_file() {
            continue;
        }

        let filename = entry.file_name().to_string_lossy().to_string();
        if matches_pattern(&filename, patterns) {
            let data = tokio::fs::read(entry.path())
                .await
                .context("Failed to read file for hashing")?;
            let mut hasher = Sha1::new();
            hasher.update(&data);
            let result = hasher.finalize();
            hashes.insert(filename, format!("{:x}", result));
        }
    }

    Ok(hashes)
}
