mod auth;
mod config;
mod console;
mod docker;
mod routes;
mod update;


use anyhow::Result;
use config::DaemonConfig;
use docker::DockerManager;
use routes::{create_router, AppState};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

#[tokio::main]
async fn main() -> Result<()> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .expect("setting default subscriber failed");

    info!("Starting minecraft-panel daemon v{}", env!("CARGO_PKG_VERSION"));

    let config = DaemonConfig::load_from_env();
    info!(bind_addr = %config.bind_addr, node_id = %config.node_id, "Configuration loaded");

    // Initialize Docker manager & startup reconciliation
    let docker_mgr = DockerManager::new()?;
    let managed_containers = docker_mgr.list_managed_containers().await?;
    info!(
        "Startup reconciliation complete: {} servers active",
        managed_containers.len()
    );

    let state = AppState {
        config: config.clone(),
        docker: docker_mgr,
        start_time: std::time::Instant::now(),
    };

    let router = create_router(state);

    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    info!("Daemon listening on http://{}", config.bind_addr);

    axum::serve(listener, router).await?;

    Ok(())
}
