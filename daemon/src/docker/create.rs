use super::DockerManager;
use anyhow::{Context, Result};
use bollard::container::{Config, CreateContainerOptions};
use bollard::models::{HostConfig, PortBinding};
use protocol::{ContainerSpec, LABEL_MANAGED, LABEL_NAME, LABEL_OWNER, LABEL_SERVER_ID};
use std::collections::HashMap;
use tracing::info;

impl DockerManager {
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
            privileged: Some(true),
            ..Default::default()
        };

        let container_name = Self::container_name(&spec.server_id);

        #[allow(unused_mut)]
        let mut env = spec.env.clone();

        #[cfg(unix)]
        {
            if let Some(vol) = spec.volumes.first() {
                if let Ok(meta) = std::fs::metadata(&vol.host_path) {
                    use std::os::unix::fs::MetadataExt;
                    let uid = meta.uid();
                    let gid = meta.gid();
                    // Inject UID and GID so the container matches host permissions
                    env.push(format!("UID={}", uid));
                    env.push(format!("GID={}", gid));
                }
            }
        }

        let config = Config {
            image: Some(spec.image.clone()),
            env: Some(env),
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

        let created = self
            .docker
            .create_container(Some(options), config)
            .await
            .context("Failed to call Docker API to create container")?;
        info!(
            server_id = %spec.server_id,
            container_id = %created.id,
            "Created Docker container"
        );

        Ok(created.id)
    }
}
