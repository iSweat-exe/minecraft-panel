use serde::{Deserialize, Serialize};

/// JWT Claims for browser/client short-lived WebSocket & direct session tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
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
