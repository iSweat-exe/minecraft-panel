use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonConfig {
    pub bind_addr: String,
    pub node_id: String,
    pub node_token: String,
    pub jwt_secret: String,
    pub docker_host: Option<String>,
    pub data_dir: String,
}

impl Default for DaemonConfig {
    fn default() -> Self {
        Self {
            bind_addr: "[::]:8080".to_string(),
            node_id: "node-local-1".to_string(),
            node_token: String::new(),
            jwt_secret: String::new(),
            docker_host: None,
            data_dir: "data/servers".to_string(),
        }
    }
}

impl DaemonConfig {
    pub fn load_from_env() -> Result<Self> {
        let mut config = Self::default();

        if let Ok(val) = std::env::var("DAEMON_BIND_ADDR") {
            config.bind_addr = val;
        }
        if let Ok(val) = std::env::var("DAEMON_NODE_ID") {
            config.node_id = val;
        }
        
        config.node_token = std::env::var("DAEMON_NODE_TOKEN")
            .context("DAEMON_NODE_TOKEN environment variable is missing. It must be provided to secure the daemon.")?;
            
        config.jwt_secret = std::env::var("DAEMON_JWT_SECRET")
            .context("DAEMON_JWT_SECRET environment variable is missing. It must be provided to secure JWT sessions.")?;
            
        if let Ok(val) = std::env::var("DOCKER_HOST") {
            config.docker_host = Some(val);
        }

        if let Ok(val) = std::env::var("DAEMON_DATA_DIR") {
            config.data_dir = val;
        }

        Ok(config)
    }
}
