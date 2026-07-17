use russh::client::{Handle, Session};
use tauri::Emitter;

#[derive(Clone)]
pub struct SshHandler {
    pub expected_fingerprint: Option<String>,
    pub app_handle: tauri::AppHandle,
}

impl russh::client::Handler for SshHandler {
    type Error = russh::Error;

    fn check_server_key(
        &mut self,
        key: &russh::keys::ssh_key::PublicKey,
    ) -> impl std::future::Future<Output = Result<bool, Self::Error>> + Send {
        let fingerprint = key.fingerprint(russh::keys::HashAlg::Sha256).to_string();
        let expected_fingerprint = self.expected_fingerprint.clone();
        let app_handle = self.app_handle.clone();

        async move {
            match expected_fingerprint {
                Some(expected) => Ok(expected == fingerprint),
                None => {
                    let _ = app_handle.emit("host-key-verification-needed", fingerprint);
                    Ok(false)
                }
            }
        }
    }
}
