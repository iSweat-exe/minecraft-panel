use super::sanitize_path;
use anyhow::{bail, Context, Result};
use protocol::FileEntry;

pub async fn list_dir(path: &str) -> Result<Vec<FileEntry>> {
    let path = sanitize_path(path)?;
    let mut entries = Vec::new();

    if !path.is_dir() {
        bail!("Path is not a directory");
    }

    let mut read_dir = tokio::fs::read_dir(path)
        .await
        .context("Failed to open directory")?;
    while let Some(entry) = read_dir
        .next_entry()
        .await
        .context("Failed to read directory entry")?
    {
        let meta = entry
            .metadata()
            .await
            .context("Failed to read file metadata")?;
        let name = entry.file_name().to_string_lossy().to_string();

        let modified = meta
            .modified()
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
