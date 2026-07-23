use std::env;
use std::fs::{self, File};
use std::io::Write;

use anyhow::{anyhow, Result};
use protocol::{UpdateDaemonRequest, UpdateDaemonResponse};
use sha2::{Digest, Sha256};
use tracing::info;

pub struct AutoUpdater;

impl AutoUpdater {
    /// Verifies Ed25519 signature of release manifest, downloads binary, verifies SHA256, and atomically swaps executable
    pub async fn apply_update(req: UpdateDaemonRequest) -> Result<UpdateDaemonResponse> {
        // 1. Cryptographically verify release manifest signature against embedded public key
        let manifest = protocol::auth::verify_manifest_signature(
            &req.manifest_json,
            &req.signature_base64,
            &protocol::auth::OFFICIAL_RELEASE_PUBLIC_KEY,
        )
        .map_err(|err| anyhow!("Security check failed: {}", err))?;

        info!(
            target_version = %manifest.target_version,
            download_url = %manifest.download_url,
            "Ed25519 signature verified. Starting daemon auto-update..."
        );

        let current_exe = env::current_exe()?;
        let exe_dir = current_exe
            .parent()
            .ok_or_else(|| anyhow!("Failed to get executable directory"))?;
        let new_binary_path = exe_dir.join(format!("daemon-update-{}.tmp", manifest.target_version));

        // 2. Download updated binary from verified manifest URL
        let response = reqwest::get(&manifest.download_url).await?;
        if !response.status().is_success() {
            return Err(anyhow!("Failed to download update: HTTP {}", response.status()));
        }

        let bytes = response.bytes().await?;

        // 3. Verify SHA256 checksum from verified manifest
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let calculated_hash = format!("{:x}", hasher.finalize());

        if calculated_hash.to_lowercase() != manifest.sha256_checksum.to_lowercase() {
            return Err(anyhow!(
                "Checksum mismatch! Expected: {}, Calculated: {}",
                manifest.sha256_checksum,
                calculated_hash
            ));
        }


        info!("SHA256 checksum verified successfully");

        // 3. Write downloaded binary to temporary path
        let mut temp_file = File::create(&new_binary_path)?;
        temp_file.write_all(&bytes)?;
        temp_file.flush()?;

        // Ensure executable permissions on Unix systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&new_binary_path)?.permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&new_binary_path, perms)?;
        }

        // 4. Atomically swap binary
        let backup_path = current_exe.with_extension("old");
        if backup_path.exists() {
            let _ = fs::remove_file(&backup_path);
        }

        // Rename running exe to .old, move new binary to current_exe
        fs::rename(&current_exe, &backup_path)?;
        if let Err(err) = fs::rename(&new_binary_path, &current_exe) {
            // Rollback if move fails
            let _ = fs::rename(&backup_path, &current_exe);
            return Err(anyhow!("Atomic binary swap failed: {}", err));
        }

        info!("Binary atomic swap succeeded. Triggering daemon restart...");

        // 5. Schedule exit for service manager (systemd Restart=on-failure/always) to restart
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            std::process::exit(0);
        });

        Ok(UpdateDaemonResponse {
            status: "success".to_string(),
            message: format!("Successfully updated to version {}. Restarting...", manifest.target_version),
        })

    }
}
