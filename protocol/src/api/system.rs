use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
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
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SignedReleaseManifest {
    pub target_version: String,
    pub download_url: String,
    pub sha256_checksum: String,
    pub timestamp: u64,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateDaemonRequest {
    pub manifest_json: String,
    pub signature_base64: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateDaemonResponse {
    pub status: String,
    pub message: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SystemMetricsResponse {
    pub cpu_percent: f64,
    pub ram_used_mb: u64,
    pub ram_total_mb: u64,
    pub disk_used_gb: f64,
    pub disk_total_gb: f64,
    pub network_rx_bytes: u64,
    pub network_tx_bytes: u64,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SystemMemoryResponse {
    pub total_mb: u64,
    pub free_mb: u64,
    pub used_mb: u64,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CrontabUpdateRequest {
    pub content: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
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


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct SystemHealthResponse {
    pub docker_responsive: bool,
    pub disk_space_warning: bool,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct HostExecRequest {
    pub command: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct HostExecResponse {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

