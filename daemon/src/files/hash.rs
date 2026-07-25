use anyhow::{bail, Context, Result};
use sha1::{Digest, Sha1};
use std::path::Path;
use tokio::io::AsyncReadExt;

async fn compute_sha1(path: &Path) -> Result<String> {
    let mut file = tokio::fs::File::open(path)
        .await
        .context("Failed to open file for hashing")?;
    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 65536];

    loop {
        let n = file
            .read(&mut buffer)
            .await
            .context("Failed to read file chunk for hashing")?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

pub async fn hash_file(path: &Path) -> Result<String> {
    if !path.is_file() {
        bail!("Path is not a file");
    }
    compute_sha1(path).await
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
    path: &Path,
    patterns: &[String],
) -> Result<std::collections::HashMap<String, String>> {
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
            let hash_str = compute_sha1(&entry.path()).await?;
            hashes.insert(filename, hash_str);
        }
    }

    Ok(hashes)
}
