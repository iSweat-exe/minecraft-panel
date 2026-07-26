use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DockerConfigUpdateRequest {
    pub config: serde_json::Value,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DockerContainerInfo {
    pub id: String,
    pub names: String,
    pub image: String,
    pub status: String,
    pub state: crate::docker::ServerState,
    pub ports: String,
    pub created: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DockerImageInfo {
    pub id: String,
    pub repository: String,
    pub tag: String,
    pub size: String,
    pub created: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
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


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct DockerUpdateRequest {
    pub new_name: Option<String>,
    pub restart_policy: Option<String>,
    pub memory: Option<String>,
    pub memory_swap: Option<String>,
}

