pub mod create;
pub mod delete;
pub mod general;
pub mod info;
pub mod power;
pub mod tty;

use anyhow::{Context, Result};
use bollard::Docker;
use std::sync::Arc;

#[derive(Clone)]
pub struct DockerManager {
    pub(crate) docker: Arc<Docker>,
}

impl DockerManager {
    pub fn new() -> Result<Self> {
        let docker = Docker::connect_with_local_defaults()
            .context("Failed to connect to local Docker daemon")?;
        Ok(Self {
            docker: Arc::new(docker),
        })
    }

    pub fn docker_client(&self) -> &Docker {
        &self.docker
    }
}
