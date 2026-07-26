use serde::{Deserialize, Serialize};

use crate::docker::ServerSpec;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ServerPowerAction {
    Start,
    Stop,
    Restart,
    Kill,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct CreateServerRequest {
    pub spec: ServerSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct UpdateServerRequest {
    pub spec: ServerSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PatchServerRequest {
    pub name: Option<String>,
    pub image: Option<String>,
    pub env: Option<Vec<String>>,
    pub ports: Option<Vec<crate::docker::PortMapping>>,
    pub volumes: Option<Vec<crate::docker::VolumeMapping>>,
    pub resources: Option<crate::docker::ServerResources>,
    pub owner: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct CreateServerResponse {
    pub server_id: String,
    pub container_id: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PowerActionRequest {
    pub action: ServerPowerAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PowerActionResponse {
    pub server_id: String,
    pub action: ServerPowerAction,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct ServerStatusResponse {
    pub server_id: String,
    pub container_id: Option<String>,
    pub name: String,
    pub image: String,
    pub state: String, // "running", "stopped", "starting", "exited", "not_found"
    pub memory_used_bytes: u64,
    pub memory_limit_bytes: u64,
    pub cpu_percent: f64,
    #[serde(default)]
    pub network_rx_bytes: u64,
    #[serde(default)]
    pub network_tx_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct ServerMetricsHistoryData {
    pub timestamp: u64,
    pub cpu_percent: f64,
    pub memory_used_bytes: u64,
    pub memory_limit_bytes: u64,
    pub disk_used_bytes: u64,
    #[serde(default)]
    pub network_rx_bytes: u64,
    #[serde(default)]
    pub network_tx_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct ServerMetricsHistoryResponse {
    pub server_id: String,
    pub history: Vec<ServerMetricsHistoryData>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct DaemonInfoResponse {
    pub version: String,
    pub protocol_version: u32,
    pub node_id: String,
    pub docker_version: String,
    pub total_servers: usize,
    pub running_servers: usize,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SignedReleaseManifest {
    pub target_version: String,
    pub download_url: String,
    pub sha256_checksum: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct UpdateDaemonRequest {
    pub manifest_json: String,
    pub signature_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct UpdateDaemonResponse {
    pub status: String,
    pub message: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SystemMetricsResponse {
    pub cpu_percent: f64,
    pub ram_used_mb: u64,
    pub ram_total_mb: u64,
    pub disk_used_gb: f64,
    pub disk_total_gb: f64,
    pub network_rx_bytes: u64,
    pub network_tx_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FileEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    #[serde(default)]
    pub permissions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum FileAction {
    Rename { new_name: String },
    Copy { destination: String },
    Delete,
    Mkdir,
    Archive { 
        archive_name: String,
        #[serde(default)]
        targets: Option<Vec<String>>
    },
    Extract,
}
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct HostExecRequest {
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct HostExecResponse {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}


#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FileActionRequest {
    pub action: FileAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FileWriteRequest {
    pub content: String, // Or base64? The Panel currently sends raw string for text files, or base64 for binaries. Let's use string.
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FileWriteBase64Request {
    pub content_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
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

// -- New API structures for SSH replacements --

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SystemMemoryResponse {
    pub total_mb: u64,
    pub free_mb: u64,
    pub used_mb: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct DockerConfigUpdateRequest {
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct CrontabUpdateRequest {
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FileHashResponse {
    pub sha1_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FileHashMultipleRequest {
    pub path: String,
    pub patterns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct FileHashMultipleResponse {
    pub hashes: std::collections::HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SystemHostResponse {
    pub os_name: String,
    pub os_version: String,
    pub kernel_version: String,
    pub cpu_model: String,
    pub cpu_cores: usize,
    pub cpu_freq_mhz: u64,
    pub disk_total_mb: u64,
    pub disk_free_mb: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SystemHealthResponse {
    pub docker_responsive: bool,
    pub disk_space_warning: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct MinecraftPingPlayer {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct MinecraftPingResponse {
    pub online_players: u32,
    pub max_players: u32,
    pub motd: String,
    pub version: String,
    pub sample: Option<Vec<MinecraftPingPlayer>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct ServerLogsResponse {
    pub lines: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct ServerCrashesResponse {
    pub crash_reports: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct DockerContainerInfo {
    pub id: String,
    pub names: String,
    pub image: String,
    pub status: String,
    pub state: String,
    pub ports: String,
    pub created: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct DockerImageInfo {
    pub id: String,
    pub repository: String,
    pub tag: String,
    pub size: String,
    pub created: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct DockerRunRequest {
    pub image: String,
    pub name: Option<String>,
    pub ports: Option<String>,
    pub env_vars: Option<Vec<String>>,
    pub restart_policy: Option<String>,
    /// When true, adds `--security-opt seccomp=unconfined --security-opt apparmor=unconfined`.
    /// Defaults to false — kernel protections stay enabled unless explicitly disabled.
    #[serde(default)]
    pub disable_security_opts: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct DockerUpdateRequest {
    pub new_name: Option<String>,
    pub restart_policy: Option<String>,
    pub memory: Option<String>,
    pub memory_swap: Option<String>,
}
