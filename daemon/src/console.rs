use std::sync::Arc;

use anyhow::Result;
use bollard::container::AttachContainerOptions;
use bollard::Docker;
use futures_util::StreamExt;
use tokio::sync::broadcast;
use tracing::info;

pub struct ConsoleStreamManager {
    docker: Arc<Docker>,
}

impl ConsoleStreamManager {
    pub fn new(docker: Arc<Docker>) -> Self {
        Self { docker }
    }

    /// Attach to container output and broadcast lines to a tokio broadcast channel
    pub async fn attach_and_broadcast(
        &self,
        server_id: &str,
        sender: broadcast::Sender<String>,
    ) -> Result<()> {
        let container_name = format!("mc-server-{}", server_id);

        let options = AttachContainerOptions::<String> {
            stdout: Some(true),
            stderr: Some(true),
            stdin: Some(false),
            stream: Some(true),
            logs: Some(true),
            ..Default::default()
        };

        let output = self
            .docker
            .attach_container(&container_name, Some(options))
            .await?;
        let mut stream = output.output;

        info!(server_id = %server_id, "Console stream attached");

        tokio::spawn(async move {
            while let Some(Ok(log_output)) = stream.next().await {
                let line = log_output.to_string();
                let _ = sender.send(line);
            }
        });

        Ok(())
    }

    /// Send input command string into container's stdin
    pub async fn send_command(&self, server_id: &str, command: &str) -> Result<()> {
        let container_name = format!("mc-server-{}", server_id);
        let mut cmd_bytes = command.as_bytes().to_vec();
        if !cmd_bytes.ends_with(b"\n") {
            cmd_bytes.push(b'\n');
        }

        let options = AttachContainerOptions::<String> {
            stdin: Some(true),
            stdout: Some(false),
            stderr: Some(false),
            stream: Some(true),
            ..Default::default()
        };

        let mut output = self
            .docker
            .attach_container(&container_name, Some(options))
            .await?;
        use tokio::io::AsyncWriteExt;
        output.input.write_all(&cmd_bytes).await?;
        output.input.flush().await?;

        Ok(())
    }
}
