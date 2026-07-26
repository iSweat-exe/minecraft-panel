use serde::{Deserialize, Serialize};
use super::{ports::PortMapping, volumes::VolumeMapping, resources::ServerResources};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ServerSpec {
    pub server_id: String,
    pub name: String,
    pub image: String,
    pub env: Vec<String>,
    pub ports: Vec<PortMapping>,
    pub volumes: Vec<VolumeMapping>,
    pub resources: ServerResources,
    pub owner: Option<String>,
}
