use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionState {
    Connected,
    Disconnected,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceAction {
    Start,
    Stop,
    Restart,
}

impl ServiceAction {
    pub fn verb(&self) -> &'static str {
        match self {
            Self::Start => "start",
            Self::Stop => "stop",
            Self::Restart => "restart",
        }
    }
}

#[derive(Serialize)]
pub struct ServiceState {
    pub active_state: String,
    pub sub_state: String,
}

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
}

#[derive(Serialize, Deserialize)]
pub struct McPingSample {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize)]
pub struct McPing {
    pub online: bool,
    pub players_online: Option<u32>,
    pub players_max: Option<u32>,
    pub latency_ms: Option<u64>,
    pub sample: Option<Vec<McPingSample>>,
}

#[derive(Serialize, Clone)]
pub struct SystemMetrics {
    pub cpu_percent: f64,
    pub ram_used_mb: u64,
    pub ram_total_mb: u64,
    pub disk_used_gb: f64,
    pub disk_total_gb: f64,
    pub network_rx_bps: u64,
    pub network_tx_bps: u64,
}

#[derive(Serialize, Clone)]
pub struct TransferProgress {
    pub filename: String,
    pub written: u64,
    pub total: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PanelUser {
    pub uuid: Option<String>,
    pub username: String,
    pub role: String,
    pub permissions: Vec<String>,
    pub created_at: Option<u64>,
    pub password_hash: Option<String>,
    pub password: Option<String>,
    pub avatar_base64: Option<String>,
    pub display_name: Option<String>,
}
