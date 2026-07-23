use serde::{Deserialize, Serialize};

/// HTTP Header used for Node Token authentication (Panel ↔ Daemon)
pub const NODE_TOKEN_HEADER: &str = "x-node-token";

/// JWT Claims for browser/client short-lived WebSocket & direct session tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonClaims {
    /// Subject (User ID or Session ID)
    pub sub: String,
    /// Target Server ID this token grants access to
    pub server_id: String,
    /// Allowed scopes/permissions (e.g. ["console:read", "console:write", "power:control"])
    pub permissions: Vec<String>,
    /// Issued at (Unix timestamp)
    pub iat: u64,
    /// Expiration time (Unix timestamp)
    pub exp: u64,
}

impl DaemonClaims {
    pub fn new(
        sub: impl Into<String>,
        server_id: impl Into<String>,
        permissions: Vec<String>,
        duration_seconds: u64,
    ) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Self {
            sub: sub.into(),
            server_id: server_id.into(),
            permissions,
            iat: now,
            exp: now + duration_seconds,
        }
    }

    pub fn has_permission(&self, permission: &str) -> bool {
        self.permissions.iter().any(|p| p == permission || p == "*")
    }
}

pub const PROTOCOL_VERSION_HEADER: &str = "x-protocol-version";


/// Embedded Ed25519 Public Key for release verification (32 bytes)
pub const OFFICIAL_RELEASE_PUBLIC_KEY: [u8; 32] = [
    // Default placeholder 32-byte public key; replace with actual release key
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
    0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
];

/// Verifies Ed25519 signature of a release manifest JSON string using a 32-byte public key
pub fn verify_manifest_signature(
    manifest_json: &str,
    signature_base64: &str,
    public_key_bytes: &[u8; 32],
) -> Result<crate::api::SignedReleaseManifest, String> {
    use base64::Engine;
    use ed25519_dalek::{Signature, Verifier, VerifyingKey};

    let sig_bytes = base64::engine::general_purpose::STANDARD
        .decode(signature_base64)
        .map_err(|e| format!("Invalid base64 signature: {}", e))?;

    let signature = Signature::from_slice(&sig_bytes)
        .map_err(|e| format!("Invalid Ed25519 signature format: {}", e))?;

    let verifying_key = VerifyingKey::from_bytes(public_key_bytes)
        .map_err(|e| format!("Invalid public key: {}", e))?;

    verifying_key
        .verify(manifest_json.as_bytes(), &signature)
        .map_err(|e| format!("Ed25519 signature verification failed: {}", e))?;

    let manifest: crate::api::SignedReleaseManifest = serde_json::from_str(manifest_json)
        .map_err(|e| format!("Invalid manifest JSON payload: {}", e))?;

    Ok(manifest)
}

/// Helper to verify protocol version compatibility
pub fn check_protocol_version(provided_version: u32) -> Result<(), String> {
    if provided_version != crate::PROTOCOL_VERSION {
        Err(format!(
            "Protocol version mismatch! Daemon requires version {}, but client provided version {}",
            crate::PROTOCOL_VERSION,
            provided_version
        ))
    } else {
        Ok(())
    }
}

