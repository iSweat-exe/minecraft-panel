use serde::{Deserialize, Serialize};

/// Standard label key to identify containers managed by minecraft-panel daemon
pub const LABEL_MANAGED: &str = "minecraft-panel.managed";

/// Standard label key for the unique server ID
pub const LABEL_SERVER_ID: &str = "minecraft-panel.server_id";

/// Standard label key for server owner / user
pub const LABEL_OWNER: &str = "minecraft-panel.owner";

/// Standard label key for server name
pub const LABEL_NAME: &str = "minecraft-panel.name";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerResources {
    pub memory_limit_bytes: Option<i64>,
    pub cpu_quota: Option<i64>,
    pub cpu_period: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortMapping {
    pub host_port: u16,
    pub container_port: u16,
    pub protocol: String, // "tcp" or "udp"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeMapping {
    pub host_path: String,
    pub container_path: String,
    pub read_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerSpec {
    pub server_id: String,
    pub name: String,
    pub image: String,
    pub env: Vec<String>,
    pub ports: Vec<PortMapping>,
    pub volumes: Vec<VolumeMapping>,
    pub resources: ContainerResources,
    pub owner: Option<String>,
}
