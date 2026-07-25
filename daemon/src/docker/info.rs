use super::DockerManager;
use anyhow::{Context, Result};
use bollard::container::ListContainersOptions;
use protocol::{ServerStatusResponse, LABEL_MANAGED, LABEL_NAME, LABEL_SERVER_ID};
use std::collections::HashMap;
use tracing::info;

impl DockerManager {
    /// Startup reconciliation: list all existing containers managed by vps-panel
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

    /// Reconstructs a ContainerSpec from an existing Docker container
    pub async fn reconstruct_spec(
        &self,
        server_id: &str,
    ) -> Result<protocol::docker::ContainerSpec> {
        let container_name = Self::container_name(server_id);
        let inspect = self
            .docker
            .inspect_container(&container_name, None)
            .await
            .context("Failed to inspect container for spec reconstruction")?;

        let labels = inspect.config.as_ref().and_then(|c| c.labels.as_ref());
        let name = labels
            .and_then(|l| l.get(LABEL_NAME))
            .cloned()
            .unwrap_or_else(|| server_id.to_string());

        let owner = labels.and_then(|l| l.get(protocol::LABEL_OWNER)).cloned();

        let image = inspect
            .config
            .as_ref()
            .and_then(|c| c.image.clone())
            .unwrap_or_else(|| "hello-world".to_string());

        let env = inspect
            .config
            .as_ref()
            .and_then(|c| c.env.clone())
            .unwrap_or_default();

        let mut ports = Vec::new();
        if let Some(port_bindings) = inspect
            .host_config
            .as_ref()
            .and_then(|hc| hc.port_bindings.as_ref())
        {
            for (port_str, bindings) in port_bindings {
                let Some(bindings) = bindings else { continue };
                for binding in bindings {
                    let Some(host_port_str) = &binding.host_port else {
                        continue;
                    };
                    let Ok(host_port) = host_port_str.parse::<u16>() else {
                        continue;
                    };

                    let parts: Vec<&str> = port_str.split('/').collect();
                    let container_port = parts[0].parse::<u16>().unwrap_or(0);
                    let protocol = parts.get(1).unwrap_or(&"tcp").to_string();
                    ports.push(protocol::docker::PortMapping {
                        host_port,
                        container_port,
                        protocol,
                    });
                }
            }
        }

        let mut volumes = Vec::new();
        if let Some(binds) = inspect
            .host_config
            .as_ref()
            .and_then(|hc| hc.binds.as_ref())
        {
            for bind in binds {
                let parts: Vec<&str> = bind.split(':').collect();
                if parts.len() >= 2 {
                    volumes.push(protocol::docker::VolumeMapping {
                        host_path: parts[0].to_string(),
                        container_path: parts[1].to_string(),
                        read_only: parts.len() >= 3 && parts[2] == "ro",
                    });
                }
            }
        }

        let mut resources = protocol::docker::ContainerResources {
            memory_limit_bytes: None,
            cpu_quota: None,
            cpu_period: None,
        };
        if let Some(host_config) = &inspect.host_config {
            resources.memory_limit_bytes =
                host_config
                    .memory
                    .and_then(|m| if m > 0 { Some(m) } else { None });
            resources.cpu_quota = host_config.cpu_quota;
            resources.cpu_period = host_config.cpu_period;
        }

        Ok(protocol::docker::ContainerSpec {
            server_id: server_id.to_string(),
            name,
            image,
            env,
            ports,
            volumes,
            resources,
            owner,
        })
    }
}
