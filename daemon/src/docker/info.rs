use super::DockerManager;
use anyhow::{Context, Result};
use bollard::container::ListContainersOptions;
use protocol::{ServerStatusResponse, LABEL_MANAGED, LABEL_NAME, LABEL_SERVER_ID};
use std::collections::HashMap;
use tracing::info;

impl DockerManager {
    /// Startup reconciliation: list all existing containers managed by minecraft-panel
    pub async fn list_managed_containers(&self) -> Result<Vec<ServerStatusResponse>> {
        let mut filters = HashMap::new();
        filters.insert("label".to_string(), vec![format!("{}=true", LABEL_MANAGED)]);

        let options = ListContainersOptions {
            all: true,
            filters,
            ..Default::default()
        };

        let containers = self
            .docker
            .list_containers(Some(options))
            .await
            .context("Failed to call Docker API to list containers")?;
        let mut result = Vec::new();

        for container in containers {
            let container_id = container.id.unwrap_or_default();
            let labels = container.labels.unwrap_or_default();
            let server_id = labels
                .get(LABEL_SERVER_ID)
                .cloned()
                .unwrap_or_else(|| "unknown".to_string());
            let name = labels
                .get(LABEL_NAME)
                .cloned()
                .unwrap_or_else(|| container.names.unwrap_or_default().join(","));
            let image = container.image.unwrap_or_default();
            let state = container.state.unwrap_or_else(|| "unknown".to_string());

            result.push(ServerStatusResponse {
                server_id,
                container_id: Some(container_id),
                name,
                image,
                state,
                memory_used_bytes: 0,
                memory_limit_bytes: 0,
                cpu_percent: 0.0,
            });
        }

        info!("Reconciled {} managed containers on startup", result.len());
        Ok(result)
    }

    /// Get details of a server container
    #[allow(dead_code)]
    pub async fn get_server_status(&self, server_id: &str) -> Result<ServerStatusResponse> {
        let container_name = format!("mc-server-{}", server_id);
        let inspect = self
            .docker
            .inspect_container(&container_name, None)
            .await
            .context("Failed to call Docker API to inspect container")?;

        let state = inspect
            .state
            .as_ref()
            .and_then(|s| s.status)
            .map(|s| s.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let labels = inspect.config.as_ref().and_then(|c| c.labels.as_ref());
        let name = labels
            .and_then(|l| l.get(LABEL_NAME))
            .cloned()
            .unwrap_or_else(|| server_id.to_string());

        let image = inspect
            .config
            .as_ref()
            .and_then(|c| c.image.clone())
            .unwrap_or_default();

        Ok(ServerStatusResponse {
            server_id: server_id.to_string(),
            container_id: inspect.id,
            name,
            image,
            state,
            memory_used_bytes: 0,
            memory_limit_bytes: 0,
            cpu_percent: 0.0,
        })
    }
}
