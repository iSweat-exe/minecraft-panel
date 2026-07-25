pub mod action;
pub mod hash;
pub mod list;
pub mod read;
pub mod write;

pub use action::perform_action;
pub use hash::{hash_file, hash_multiple_files};
pub use list::list_dir;
pub use read::read_file;
pub use write::write_file;

use anyhow::{bail, Result};
use std::path::PathBuf;

pub(crate) fn sanitize_path(path_str: &str) -> Result<PathBuf> {
    let path = PathBuf::from(path_str);
    // Simple traversal check for basic security
    if path
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        bail!("Path traversal is not allowed");
    }
    
    Ok(path)
}

#[cfg(unix)]
pub(crate) fn fix_permissions_for(target: &std::path::Path, reference: &std::path::Path) -> Result<()> {
    if let Ok(meta) = std::fs::metadata(reference) {
        use std::os::unix::fs::MetadataExt;
        let uid = meta.uid();
        let gid = meta.gid();
        let path_str = target.to_string_lossy();
        std::process::Command::new("chown")
            .arg("-R")
            .arg(format!("{}:{}", uid, gid))
            .arg(path_str.as_ref())
            .status()?;
    }
    Ok(())
}

#[cfg(not(unix))]
pub(crate) fn fix_permissions_for(_target: &std::path::Path, _reference: &std::path::Path) -> Result<()> {
    Ok(())
}
