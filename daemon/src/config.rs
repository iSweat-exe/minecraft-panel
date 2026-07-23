use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonConfig {
    pub bind_addr: String,
    pub node_id: String,
    pub node_token: String,
    pub jwt_secret: String,
    pub docker_host: Option<String>,
}

impl Default for DaemonConfig {
    fn default() -> Self {
        Self {
            bind_addr: "0.0.0.0:8080".to_string(),
            node_id: "node-local-1".to_string(),
            node_token: "secret-node-token-change-me".to_string(),
            jwt_secret: "secret-jwt-key-change-me".to_string(),
            docker_host: None,
        }
    }
}

impl DaemonConfig {
    pub fn load_from_env() -> Self {
        let mut config = Self::default();

        if let Ok(val) = std::env::var("DAEMON_BIND_ADDR") {
            config.bind_addr = val;
        }
        if let Ok(val) = std::env::var("DAEMON_NODE_ID") {
            config.node_id = val;
        }
        if let Ok(val) = std::env::var("DAEMON_NODE_TOKEN") {
            config.node_token = val;
        }
        if let Ok(val) = std::env::var("DAEMON_JWT_SECRET") {
            config.jwt_secret = val;
        }
        if let Ok(val) = std::env::var("DOCKER_HOST") {
            config.docker_host = Some(val);
        }

        config
    }
}
