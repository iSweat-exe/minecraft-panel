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
    pub fn load() -> Result<Self> {
        let config_path = std::path::Path::new("config.yml");

        let mut config: Self = if config_path.exists() {
            let file_contents =
                std::fs::read_to_string(config_path).context("Failed to read config.yml")?;
            serde_yaml::from_str(&file_contents)
                .context("Failed to parse config.yml. Please check the YAML syntax.")?
        } else {
            // Generate default config
            let default_config = Self {
                node_token: "CHANGE_ME_PLEASE_TO_A_SECURE_TOKEN".to_string(),
                jwt_secret: "CHANGE_ME_PLEASE_TO_A_VERY_SECURE_RANDOM_SECRET_KEY".to_string(),
                ..Default::default()
            };

            let yaml = serde_yaml::to_string(&default_config)
                .context("Failed to serialize default config")?;

            std::fs::write(config_path, yaml).context("Failed to write default config.yml")?;

            tracing::info!("A default config.yml file has been generated.");
            tracing::info!("Please edit config.yml to set your 'node_token' and 'jwt_secret', then restart the daemon.");
            std::process::exit(0);
        };

        // Override with Environment Variables if present
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
        if let Ok(val) = std::env::var("DAEMON_DATA_DIR") {
            config.data_dir = val;
        }

        if config.node_token == "CHANGE_ME_PLEASE_TO_A_SECURE_TOKEN"
            || config.jwt_secret == "CHANGE_ME_PLEASE_TO_A_VERY_SECURE_RANDOM_SECRET_KEY"
        {
            anyhow::bail!("You must change the default 'node_token' and 'jwt_secret' in config.yml or via environment variables before running the daemon.");
        }

        if config.node_token.is_empty() {
            anyhow::bail!("DAEMON_NODE_TOKEN or node_token in config.yml is missing.");
        }
        if config.jwt_secret.is_empty() {
            anyhow::bail!("DAEMON_JWT_SECRET or jwt_secret in config.yml is missing.");
        }

        Ok(config)
    }
}
