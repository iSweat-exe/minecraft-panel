use super::DockerManager;
use anyhow::{Context, Result};
use bollard::container::RemoveContainerOptions;
use tracing::info;

impl DockerManager {
    /// Remove container for a server
    pub async fn remove_container(&self, server_id: &str) -> Result<()> {
        let container_name = format!("mc-server-{}", server_id);
        let options = RemoveContainerOptions {
            force: true,
            ..Default::default()
        };

        self.docker
            .remove_container(&container_name, Some(options))
            .await
            .context("Failed to call Docker API to remove container")?;
        info!(server_id = %server_id, "Container removed");
        Ok(())
    }
}
