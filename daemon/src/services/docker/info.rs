use super::DockerManager;
use anyhow::{Context, Result};
use bollard::container::ListContainersOptions;
use protocol::{ServerStatusResponse, LABEL_MANAGED, LABEL_NAME, LABEL_SERVER_ID};
use std::collections::HashMap;
use tracing::info;

impl DockerManager {
    /// Get a single managed container by server_id
    pub async fn get_managed_container(
        &self,
        server_id: &str,
    ) -> Result<Option<ServerStatusResponse>> {
        let mut filters = HashMap::new();
        filters.insert("name".to_string(), vec![Self::container_name(server_id)]);

        let options = ListContainersOptions {
            all: true,
            filters,
            ..Default::default()
        };

        let containers = self
            .docker
            .list_containers(Some(options))
            .await
            .context("Failed to call Docker API to list container")?;

        if let Some(container) = containers.into_iter().next() {
            let container_id = container.id.unwrap_or_default();
            let labels = container.labels.unwrap_or_default();
            let s_id = labels
                .get(LABEL_SERVER_ID)
                .cloned()
                .unwrap_or_else(|| server_id.to_string());
            let name = labels
                .get(LABEL_NAME)
                .cloned()
                .unwrap_or_else(|| container.names.unwrap_or_default().join(","));
            let image = container.image.unwrap_or_default();
            let state = container.state.unwrap_or_else(|| "unknown".to_string());

            let (
                cpu_percent,
                memory_used_bytes,
                memory_limit_bytes,
                network_rx_bytes,
                network_tx_bytes,
            ) = if state == "running" {
                self.get_container_metrics(&container_id)
                    .await
                    .unwrap_or_else(|e| {
                        tracing::warn!(server_id = %s_id, "Failed to get live metrics: {}", e);
                        (0.0, 0, 0, 0, 0)
                    })
            } else {
                (0.0, 0, 0, 0, 0)
            };

            return Ok(Some(ServerStatusResponse {
                server_id: s_id,
                container_id: Some(container_id),
                name,
                image,
                state,
                memory_used_bytes,
                memory_limit_bytes,
                cpu_percent,
                network_rx_bytes,
                network_tx_bytes,
            }));
        }

        Ok(None)
    }

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

            let (
                cpu_percent,
                memory_used_bytes,
                memory_limit_bytes,
                network_rx_bytes,
                network_tx_bytes,
            ) =
                if state == "running" {
                    self.get_container_metrics(&container_id).await.unwrap_or_else(|e| {
                        tracing::warn!(server_id = %server_id, "Failed to get live metrics: {}", e);
                        (0.0, 0, 0, 0, 0)
                    })
                } else {
                    (0.0, 0, 0, 0, 0)
                };

            result.push(ServerStatusResponse {
                server_id,
                container_id: Some(container_id),
                name,
                image,
                state,
                memory_used_bytes,
                memory_limit_bytes,
                cpu_percent,
                network_rx_bytes,
                network_tx_bytes,
            });
        }

        info!("Reconciled {} managed containers on startup", result.len());
        Ok(result)
    }

    /// Reconstructs a ContainerSpec from an existing Docker container
    pub async fn reconstruct_spec(&self, server_id: &str) -> Result<protocol::docker::ServerSpec> {
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

        let mut resources = protocol::docker::ServerResources {
            memory_limit_bytes: None,
            cpu_quota: None,
            cpu_period: None,
        };
        if let Some(host_config) = &inspect.host_config {
            resources.memory_limit_bytes = host_config.memory.filter(|&m| m > 0);
            resources.cpu_quota = host_config.cpu_quota;
            resources.cpu_period = host_config.cpu_period;
        }

        Ok(protocol::docker::ServerSpec {
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

    pub async fn get_container_metrics(
        &self,
        container_id: &str,
    ) -> Result<(f64, u64, u64, u64, u64)> {
        use bollard::container::StatsOptions;
        use futures_util::stream::StreamExt;

        let options = StatsOptions {
            stream: false,
            one_shot: true,
        };

        let mut stats_stream = self.docker.stats(container_id, Some(options));
        if let Some(Ok(stats)) = stats_stream.next().await {
            // CPU
            let cpu_delta = stats.cpu_stats.cpu_usage.total_usage as f64
                - stats.precpu_stats.cpu_usage.total_usage as f64;
            let system_cpu_delta = stats.cpu_stats.system_cpu_usage.unwrap_or(0) as f64
                - stats.precpu_stats.system_cpu_usage.unwrap_or(0) as f64;
            let number_cpus = stats.cpu_stats.online_cpus.unwrap_or(1) as f64;

            let mut cpu_percent = 0.0;
            if system_cpu_delta > 0.0 && cpu_delta > 0.0 {
                cpu_percent = (cpu_delta / system_cpu_delta) * number_cpus * 100.0;
            }

            // Memory
            let memory_used = stats.memory_stats.usage.unwrap_or(0);
            let memory_limit = stats.memory_stats.limit.unwrap_or(0);

            // Network
            let mut rx_bytes = 0;
            let mut tx_bytes = 0;
            if let Some(networks) = stats.networks {
                for net_stats in networks.values() {
                    rx_bytes += net_stats.rx_bytes;
                    tx_bytes += net_stats.tx_bytes;
                }
            }

            Ok((cpu_percent, memory_used, memory_limit, rx_bytes, tx_bytes))
        } else {
            anyhow::bail!("Failed to get stats from container stream")
        }
    }
}
