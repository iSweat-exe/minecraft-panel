use super::DockerManager;
use anyhow::{Context, Result};
use bollard::container::{
    KillContainerOptions, RestartContainerOptions, StartContainerOptions, StopContainerOptions,
};
use protocol::ServerPowerAction;
use tracing::{info, warn};

impl DockerManager {
    /// Execute power actions on a container identified by server_id
    pub async fn power_action(&self, server_id: &str, action: ServerPowerAction) -> Result<()> {
        let container_name = format!("mc-server-{}", server_id);

        match action {
            ServerPowerAction::Start => {
                self.docker
                    .start_container(&container_name, None::<StartContainerOptions<String>>)
                    .await
                    .context("Failed to call Docker API to start container")?;
                info!(server_id = %server_id, "Server started");
            }
            ServerPowerAction::Stop => {
                let options = StopContainerOptions { t: 30 };
                self.docker
                    .stop_container(&container_name, Some(options))
                    .await
                    .context("Failed to call Docker API to stop container")?;
                info!(server_id = %server_id, "Server stopped gracefully");
            }
            ServerPowerAction::Restart => {
                let options = RestartContainerOptions { t: 30 };
                self.docker
                    .restart_container(&container_name, Some(options))
                    .await
                    .context("Failed to call Docker API to restart container")?;
                info!(server_id = %server_id, "Server restarted");
            }
            ServerPowerAction::Kill => {
                let options = KillContainerOptions { signal: "SIGKILL" };
                self.docker
                    .kill_container(&container_name, Some(options))
                    .await
                    .context("Failed to call Docker API to kill container")?;
                warn!(server_id = %server_id, "Server killed");
            }
        }

        Ok(())
    }
}
