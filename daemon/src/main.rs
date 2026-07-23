mod auth;
mod config;
mod console;
mod docker;
mod files;
mod metrics;
mod routes;
mod update;

use anyhow::Result;
use config::DaemonConfig;
use docker::DockerManager;
use routes::{create_router, AppState};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && args[1] == "update" {
        if let Err(e) = update::AutoUpdater::perform_cli_update().await {
            eprintln!("Update failed: {:#}", e);
            std::process::exit(1);
        }
        std::process::exit(0);
    }

    let file_appender = tracing_appender::rolling::never(".", "daemon.log");
    let (file_writer, _guard) = tracing_appender::non_blocking(file_appender);

    let console_layer = tracing_subscriber::fmt::layer().with_writer(std::io::stdout);

    let file_layer = tracing_subscriber::fmt::layer()
        .with_writer(file_writer)
        .with_ansi(false);

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new("info"))
        .with(console_layer)
        .with(file_layer)
        .init();

    info!(
        "Starting minecraft-panel daemon v{}",
        env!("CARGO_PKG_VERSION")
    );

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
