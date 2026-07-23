use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;

use bollard::container::{
    Config, CreateContainerOptions, KillContainerOptions, ListContainersOptions,
    RemoveContainerOptions, RestartContainerOptions, StartContainerOptions, StopContainerOptions,
};
use bollard::models::{HostConfig, PortBinding};
use bollard::Docker;
use protocol::{
    ContainerSpec, ServerPowerAction, ServerStatusResponse, LABEL_MANAGED, LABEL_NAME,
    LABEL_OWNER, LABEL_SERVER_ID,
};
use tracing::{info, warn};

#[derive(Clone)]
pub struct DockerManager {
    docker: Arc<Docker>,
}

impl DockerManager {
    pub fn new() -> Result<Self> {
        let docker = Docker::connect_with_local_defaults()?;
        Ok(Self {
            docker: Arc::new(docker),
        })
    }

    pub fn docker_client(&self) -> &Docker {
        &self.docker
    }

    /// Startup reconciliation: list all existing containers managed by minecraft-panel
    pub async fn list_managed_containers(&self) -> Result<Vec<ServerStatusResponse>> {
        let mut filters = HashMap::new();
        filters.insert(
            "label".to_string(),
            vec![format!("{}=true", LABEL_MANAGED)],
        );

        let options = ListContainersOptions {
            all: true,
            filters,
            ..Default::default()
        };

        let containers = self.docker.list_containers(Some(options)).await?;
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

    /// Create a new server container with specified spec and labels
    pub async fn create_server_container(&self, spec: &ContainerSpec) -> Result<String> {
        let mut labels = HashMap::new();
        labels.insert(LABEL_MANAGED.to_string(), "true".to_string());
        labels.insert(LABEL_SERVER_ID.to_string(), spec.server_id.clone());
        labels.insert(LABEL_NAME.to_string(), spec.name.clone());
        if let Some(owner) = &spec.owner {
            labels.insert(LABEL_OWNER.to_string(), owner.clone());
        }

        let mut port_bindings = HashMap::new();
        for port_map in &spec.ports {
            let key = format!("{}/{}", port_map.container_port, port_map.protocol);
            port_bindings.insert(
                key,
                Some(vec![PortBinding {
                    host_ip: Some("0.0.0.0".to_string()),
                    host_port: Some(port_map.host_port.to_string()),
                }]),
            );
        }

        let mut binds = Vec::new();
        for vol in &spec.volumes {
            let mode = if vol.read_only { "ro" } else { "rw" };
            binds.push(format!("{}:{}:{}", vol.host_path, vol.container_path, mode));
        }

        let host_config = HostConfig {
            port_bindings: Some(port_bindings),
            binds: Some(binds),
            memory: spec.resources.memory_limit_bytes,
            cpu_quota: spec.resources.cpu_quota,
            cpu_period: spec.resources.cpu_period,
            restart_policy: Some(bollard::models::RestartPolicy {
                name: Some(bollard::models::RestartPolicyNameEnum::UNLESS_STOPPED),
                maximum_retry_count: None,
            }),
            security_opt: Some(vec![
                "seccomp=unconfined".to_string(),
                "apparmor=unconfined".to_string(),
            ]),
            ..Default::default()
        };


        let container_name = format!("mc-server-{}", spec.server_id);
        let config = Config {
            image: Some(spec.image.clone()),
            env: Some(spec.env.clone()),
            labels: Some(labels),
            host_config: Some(host_config),
            attach_stdin: Some(true),
            attach_stdout: Some(true),
            attach_stderr: Some(true),
            open_stdin: Some(true),
            tty: Some(true),
            ..Default::default()
        };

        let options = CreateContainerOptions {
            name: container_name.as_str(),
            platform: None,
        };

        let created = self.docker.create_container(Some(options), config).await?;
        info!(
            server_id = %spec.server_id,
            container_id = %created.id,
            "Created Docker container"
        );

        Ok(created.id)
    }

    /// Execute power actions on a container identified by server_id
    pub async fn power_action(&self, server_id: &str, action: ServerPowerAction) -> Result<()> {
        let container_name = format!("mc-server-{}", server_id);

        match action {
            ServerPowerAction::Start => {
                self.docker
                    .start_container(&container_name, None::<StartContainerOptions<String>>)
                    .await?;
                info!(server_id = %server_id, "Server started");
            }
            ServerPowerAction::Stop => {
                let options = StopContainerOptions { t: 30 };
                self.docker.stop_container(&container_name, Some(options)).await?;
                info!(server_id = %server_id, "Server stopped gracefully");
            }
            ServerPowerAction::Restart => {
                let options = RestartContainerOptions { t: 30 };
                self.docker
                    .restart_container(&container_name, Some(options))
                    .await?;
                info!(server_id = %server_id, "Server restarted");
            }
            ServerPowerAction::Kill => {
                let options = KillContainerOptions {
                    signal: "SIGKILL",
                };
                self.docker.kill_container(&container_name, Some(options)).await?;
                warn!(server_id = %server_id, "Server killed");
            }
        }

        Ok(())
    }

    /// Remove container for a server
    pub async fn remove_container(&self, server_id: &str) -> Result<()> {
        let container_name = format!("mc-server-{}", server_id);
        let options = RemoveContainerOptions {
            force: true,
            ..Default::default()
        };

        self.docker.remove_container(&container_name, Some(options)).await?;
        info!(server_id = %server_id, "Container removed");
        Ok(())
    }

    /// Resize terminal TTY dimensions for a container
    pub async fn resize_tty(&self, server_id: &str, width: u16, height: u16) -> Result<()> {
        let container_name = format!("mc-server-{}", server_id);
        let options = bollard::container::ResizeContainerTtyOptions {
            height,
            width,
        };

        self.docker.resize_container_tty(&container_name, options).await?;
        info!(server_id = %server_id, width = width, height = height, "Resized container TTY");
        Ok(())
    }

    /// Get details of a server container

    #[allow(dead_code)]
    pub async fn get_server_status(&self, server_id: &str) -> Result<ServerStatusResponse> {
        let container_name = format!("mc-server-{}", server_id);
        let inspect = self.docker.inspect_container(&container_name, None).await?;

        let state = inspect
            .state
            .as_ref()
            .and_then(|s| s.status.clone())
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
