use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ServerResources {
    pub memory_limit_bytes: Option<i64>,
    pub cpu_quota: Option<i64>,
    pub cpu_period: Option<i64>,
}
