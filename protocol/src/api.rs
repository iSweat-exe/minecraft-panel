use serde::{Deserialize, Serialize};

use crate::docker::ContainerSpec;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ServerPowerAction {
    Start,
    Stop,
    Restart,
    Kill,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateServerRequest {
    pub spec: ContainerSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateServerResponse {
    pub server_id: String,
    pub container_id: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PowerActionRequest {
    pub action: ServerPowerAction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PowerActionResponse {
    pub server_id: String,
    pub action: ServerPowerAction,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatusResponse {
    pub server_id: String,
    pub container_id: Option<String>,
    pub name: String,
    pub image: String,
    pub state: String, // "running", "stopped", "starting", "exited", "not_found"
    pub memory_used_bytes: u64,
    pub memory_limit_bytes: u64,
    pub cpu_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonInfoResponse {
    pub version: String,
    pub protocol_version: u32,
    pub node_id: String,
    pub docker_version: String,
    pub total_servers: usize,
    pub running_servers: usize,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedReleaseManifest {
    pub target_version: String,
    pub download_url: String,
    pub sha256_checksum: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateDaemonRequest {
    pub manifest_json: String,
    pub signature_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateDaemonResponse {
    pub status: String,
    pub message: String,
}



#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(message: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.into()),
        }
    }
}
