use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct VolumeMapping {
    pub host_path: String,
    pub container_path: String,
    pub read_only: bool,
}
