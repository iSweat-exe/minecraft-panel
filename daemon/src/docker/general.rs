use super::DockerManager;
use anyhow::{Context, Result};
use bollard::container::ListContainersOptions;
use bollard::image::ListImagesOptions;
use protocol::{DockerContainerInfo, DockerImageInfo};
use tokio::process::Command;

impl DockerManager {
    pub async fn list_all_containers(&self) -> Result<Vec<DockerContainerInfo>> {
        let options = ListContainersOptions::<String> {
            all: true,
            ..Default::default()
        };

        let containers = self
            .docker
            .list_containers(Some(options))
            .await
            .context("Failed to list containers")?;

        let mut result = Vec::new();
        for c in containers {
            let id = c.id.unwrap_or_default();
            let names = c.names.unwrap_or_default().join(", ");
            let image = c.image.unwrap_or_default();
            let status = c.status.unwrap_or_default();
            let state = c.state.unwrap_or_default();
            
            let mut ports_str = String::new();
            if let Some(ports) = c.ports {
                for p in ports {
                    let ip = p.ip.unwrap_or_default();
                    let public = p.public_port.map(|v| v.to_string()).unwrap_or_default();
                    let private = p.private_port.to_string();
                    let typ = p.typ.map(|t| t.to_string()).unwrap_or_else(|| "tcp".to_string());
                    if !ports_str.is_empty() {
                        ports_str.push_str(", ");
                    }
                    if !public.is_empty() && !ip.is_empty() {
                        ports_str.push_str(&format!("{}:{}->{}/{}", ip, public, private, typ));
                    } else {
                        ports_str.push_str(&format!("{}/{}", private, typ));
                    }
                }
            }

            let created = if let Some(ts) = c.created {
                ts.to_string()
            } else {
                "Unknown".to_string()
            };

            result.push(DockerContainerInfo {
                id,
                names,
                image,
                status,
                state,
                ports: ports_str,
                created,
            });
        }

        Ok(result)
    }

    pub async fn list_all_images(&self) -> Result<Vec<DockerImageInfo>> {
        let options = ListImagesOptions::<String> {
            all: false,
            ..Default::default()
        };

        let images = self
            .docker
            .list_images(Some(options))
            .await
            .context("Failed to list images")?;

        let mut result = Vec::new();
        for img in images {
            let id = img.id.clone();
            
            // Repotags is usually ["repository:tag"]
            let mut repository = "<none>".to_string();
            let mut tag = "<none>".to_string();
            if let Some(first) = img.repo_tags.first() {
                let parts: Vec<&str> = first.split(':').collect();
                if parts.len() >= 2 {
                    repository = parts[0].to_string();
                    tag = parts[1].to_string();
                } else if parts.len() == 1 {
                    repository = parts[0].to_string();
                }
            }

            let size = img.size;
            // Format size as MB or GB
            let size_str = if size > 1024 * 1024 * 1024 {
                format!("{:.2} GB", size as f64 / (1024.0 * 1024.0 * 1024.0))
            } else {
                format!("{:.2} MB", size as f64 / (1024.0 * 1024.0))
            };

            let created = img.created.to_string();

            result.push(DockerImageInfo {
                id,
                repository,
                tag,
                size: size_str,
                created,
            });
        }

        Ok(result)
    }

    pub async fn run_docker_command(&self, args: &[&str]) -> Result<String> {
        let output = Command::new("docker")
            .args(args)
            .output()
            .await
            .context("Failed to execute docker cli command")?;
            
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Command failed: {}", err)
        }
    }
}
