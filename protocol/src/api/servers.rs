use serde::{Deserialize, Serialize};
use crate::docker::ServerSpec;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum ServerPowerAction {
    Start,
    Stop,
    Restart,
    Kill,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateServerRequest {
    pub spec: ServerSpec,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct UpdateServerRequest {
    pub spec: ServerSpec,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PatchServerRequest {
    pub name: Option<String>,
    pub image: Option<String>,
    pub env: Option<Vec<String>>,
    pub ports: Option<Vec<crate::docker::PortMapping>>,
    pub volumes: Option<Vec<crate::docker::VolumeMapping>>,
    pub resources: Option<crate::docker::ServerResources>,
    pub owner: Option<String>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct CreateServerResponse {
    pub server_id: String,
    pub container_id: String,
    pub status: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PowerActionRequest {
    pub action: ServerPowerAction,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PowerActionResponse {
    pub server_id: String,
    pub action: ServerPowerAction,
    pub success: bool,
    pub message: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ServerStatusResponse {
    pub server_id: String,
    pub container_id: Option<String>,
    pub name: String,
    pub image: String,
    pub state: crate::docker::ServerState, // "running", "stopped", "starting", "exited", "not_found"
    pub memory_used_bytes: u64,
    pub memory_limit_bytes: u64,
    pub cpu_percent: f64,
    #[serde(default)]
    pub network_rx_bytes: u64,
    #[serde(default)]
    pub network_tx_bytes: u64,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
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


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ServerMetricsHistoryResponse {
    pub server_id: String,
    pub history: Vec<ServerMetricsHistoryData>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ServerLogsResponse {
    pub lines: Vec<String>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ServerCrashesResponse {
    pub crash_reports: Vec<String>,
}

