use super::DockerManager;
use anyhow::{Context, Result};
use tracing::info;

impl DockerManager {
    /// Resize terminal TTY dimensions for a container
    pub async fn resize_tty(&self, server_id: &str, width: u16, height: u16) -> Result<()> {
        let container_name = format!("mc-server-{}", server_id);
        let options = bollard::container::ResizeContainerTtyOptions { height, width };

        self.docker
            .resize_container_tty(&container_name, options)
            .await
            .context("Failed to call Docker API to resize TTY")?;
        info!(server_id = %server_id, width = width, height = height, "Resized container TTY");
        Ok(())
    }
}
