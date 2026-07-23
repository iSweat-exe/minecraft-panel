use std::env;
use std::fs::{self, File};
use std::io::Write;

use anyhow::{anyhow, Context, Result};
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
        .map_err(|e| {
            anyhow!(
                "Security check failed: invalid release manifest signature: {}",
                e
            )
        })?;

        info!(
            target_version = %manifest.target_version,
            download_url = %manifest.download_url,
            "Ed25519 signature verified. Starting daemon auto-update..."
        );

        let current_exe = env::current_exe()?;
        let exe_dir = current_exe
            .parent()
            .context("Failed to get executable directory")?;
        let new_binary_path =
            exe_dir.join(format!("daemon-update-{}.tmp", manifest.target_version));

        // 2. Download updated binary from verified manifest URL
        let response = reqwest::get(&manifest.download_url)
            .await
            .context("Failed to connect to update server")?;

        if !response.status().is_success() {
            anyhow::bail!("Failed to download update: HTTP {}", response.status());
        }

        let bytes = response
            .bytes()
            .await
            .context("Failed to read update payload")?;

        // 3. Verify SHA256 checksum from verified manifest
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let calculated_hash = format!("{:x}", hasher.finalize());

        if calculated_hash.to_lowercase() != manifest.sha256_checksum.to_lowercase() {
            anyhow::bail!(
                "Checksum mismatch! Expected: {}, Calculated: {}",
                manifest.sha256_checksum,
                calculated_hash
            );
        }

        info!("SHA256 checksum verified successfully");

        // 3. Write downloaded binary to temporary path
        let mut temp_file =
            File::create(&new_binary_path).context("Failed to create temporary file for update")?;
        temp_file
            .write_all(&bytes)
            .context("Failed to write to temporary file")?;
        temp_file
            .flush()
            .context("Failed to flush temporary file")?;

        // Ensure executable permissions on Unix systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&new_binary_path)
                .context("Failed to read metadata of new binary")?
                .permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&new_binary_path, perms)
                .context("Failed to set executable permissions")?;
        }

        // 4. Atomically swap binary
        let backup_path = current_exe.with_extension("old");
        if backup_path.exists() {
            let _ = fs::remove_file(&backup_path);
        }

        // Rename running exe to .old, move new binary to current_exe
        fs::rename(&current_exe, &backup_path).context("Failed to backup current executable")?;
        if let Err(err) = fs::rename(&new_binary_path, &current_exe) {
            // Rollback if move fails
            let _ = fs::rename(&backup_path, &current_exe);
            anyhow::bail!("Atomic binary swap failed: {}", err);
        }

        info!("Binary atomic swap succeeded. Triggering daemon restart...");

        // 5. Schedule exit for service manager (systemd Restart=on-failure/always) to restart
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            std::process::exit(0);
        });

        Ok(UpdateDaemonResponse {
            status: "success".to_string(),
            message: format!(
                "Successfully updated to version {}. Restarting...",
                manifest.target_version
            ),
        })
    }

    /// Performs a manual CLI update by fetching the latest release from GitHub
    pub async fn perform_cli_update() -> Result<()> {
        let client = reqwest::Client::builder()
            .user_agent("minecraft-panel-daemon")
            .build()?;

        println!("Fetching latest release info from GitHub...");
        let release_url = "https://api.github.com/repos/iSweat/minecraft-panel/releases/latest";
        let response = client.get(release_url).send().await.context("Failed to connect to GitHub API")?;
        
        if !response.status().is_success() {
            anyhow::bail!("GitHub API returned HTTP {}", response.status());
        }

        let release_resp: serde_json::Value = response.json().await.context("Failed to parse JSON")?;
        
        let tag_name = release_resp["tag_name"].as_str().unwrap_or("unknown");
        println!("Found latest version: {}", tag_name);

        let os = std::env::consts::OS;
        let arch = match std::env::consts::ARCH {
            "x86_64" => "amd64",
            "aarch64" => "arm64",
            other => other,
        };

        // Expected asset name format, e.g., daemon-linux-amd64
        let asset_name = format!("daemon-{}-{}", os, arch);
        
        let assets = release_resp["assets"].as_array().context("No assets found in release")?;
        let mut download_url = None;

        for asset in assets {
            if let Some(name) = asset["name"].as_str() {
                if name == asset_name || name == format!("{}.exe", asset_name) {
                    download_url = asset["browser_download_url"].as_str().map(|s| s.to_string());
                    break;
                }
            }
        }

        let download_url = download_url.context(format!("Could not find binary for architecture {}/{} (looked for {})", os, arch, asset_name))?;
        println!("Downloading from: {}", download_url);

        let response = client.get(&download_url).send().await.context("Failed to download binary")?;
        if !response.status().is_success() {
            anyhow::bail!("Download failed with HTTP {}", response.status());
        }

        let bytes = response.bytes().await.context("Failed to read bytes")?;

        let current_exe = std::env::current_exe()?;
        let new_exe = current_exe.with_extension("tmp");

        println!("Writing new binary to disk...");
        std::fs::write(&new_exe, &bytes).context("Failed to write new binary")?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&new_exe)?.permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&new_exe, perms).context("Failed to set executable permissions")?;
        }

        let backup_path = current_exe.with_extension("old");
        if backup_path.exists() {
            let _ = std::fs::remove_file(&backup_path);
        }

        println!("Swapping binaries...");
        std::fs::rename(&current_exe, &backup_path).context("Failed to backup old binary")?;
        if let Err(e) = std::fs::rename(&new_exe, &current_exe) {
            let _ = std::fs::rename(&backup_path, &current_exe);
            anyhow::bail!("Failed to swap binary: {}", e);
        }

        println!("Update successful! The new version will be used on next restart.");
        // We don't automatically restart systemd here because the user is running it manually in a CLI
        Ok(())
    }
}
