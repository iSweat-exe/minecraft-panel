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

pub(crate) fn sanitize_path(server_id: &str, data_dir: &str, user_path: &str) -> Result<PathBuf> {
    // 1. Rejeter les tentatives basiques de directory traversal
    if user_path.contains("..") {
        bail!("Path traversal is not allowed (.. detected)");
    }

    // 2. Construire la racine du serveur
    // Ex: "data/servers/12345"
    let mut base_dir = PathBuf::from(data_dir);
    base_dir.push(server_id);
    // On la rend absolue et canonique si elle existe, sinon juste absolue
    let base_dir = std::fs::canonicalize(&base_dir).unwrap_or_else(|_| {
        let mut absolute = std::env::current_dir().unwrap_or_default();
        absolute.push(&base_dir);
        absolute
    });

    // 3. Traiter le chemin utilisateur comme relatif à la racine du serveur
    // Si l'utilisateur envoie "/world", on le transforme en "world" pour éviter qu'il n'écrase base_dir
    let relative_user_path = user_path.trim_start_matches('/');
    let mut final_path = base_dir.clone();
    final_path.push(relative_user_path);

    // 4. Si le fichier existe, s'assurer que sa forme canonique est bien DANS le dossier serveur
    if final_path.exists() {
        let canonical_final = std::fs::canonicalize(&final_path)?;
        if !canonical_final.starts_with(&base_dir) {
            bail!("Path traversal is not allowed (escaped server directory)");
        }
    }

    Ok(final_path)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_path_valid() {
        let res = sanitize_path("server1", "data/servers", "world/level.dat");
        assert!(res.is_ok());
        let path = res.unwrap();
        assert!(path.to_string_lossy().contains("server1"));
        assert!(path.to_string_lossy().contains("level.dat"));
    }

    #[test]
    fn test_sanitize_path_rejects_parent_traversal() {
        let res = sanitize_path("server1", "data/servers", "../secret.txt");
        assert!(res.is_err());
        assert!(res.unwrap_err().to_string().contains("Path traversal"));
    }

    #[test]
    fn test_sanitize_path_strips_leading_slash() {
        let res = sanitize_path("server1", "data/servers", "/server.properties");
        assert!(res.is_ok());
        let path = res.unwrap();
        assert!(path.to_string_lossy().ends_with("server.properties"));
    }
}
