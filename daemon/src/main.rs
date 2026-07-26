mod config;
mod error;
mod routes;
mod services;

use anyhow::Result;
use config::DaemonConfig;
use routes::{create_router, AppState};
use services::docker::DockerManager;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && args[1] == "update" {
        if let Err(e) = services::update::AutoUpdater::perform_cli_update().await {
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

    info!("Starting vps-panel daemon v{}", env!("CARGO_PKG_VERSION"));

    let config = DaemonConfig::load()?;
    info!(bind_addr = %config.bind_addr, node_id = %config.node_id, "Configuration loaded");

    // Initialize Docker manager & startup reconciliation
    let docker_mgr = DockerManager::new()?;
    let managed_containers = docker_mgr.list_managed_containers().await?;
    let db_pool = match services::db::init_db().await {
        Ok(pool) => {
            info!("SQLite database initialized");
            pool
        }
        Err(e) => {
            eprintln!("Failed to initialize database: {}", e);
            std::process::exit(1);
        }
    };

    // Backfill unmanaged containers into SQLite
    let _ = services::db::backfill_unmanaged_containers(&db_pool, &docker_mgr, &managed_containers)
        .await;

    info!(
        "Startup reconciliation complete: {} servers active",
        managed_containers.len()
    );

    tokio::spawn(crate::services::metrics::start_metrics_collector(
        db_pool.clone(),
        docker_mgr.clone(),
    ));

    let automation_jobs =
        std::sync::Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new()));

    let console_mgr = std::sync::Arc::new(services::console::ConsoleStreamManager::new(
        std::sync::Arc::new(docker_mgr.docker_client().clone()),
    ));

    let task_mgr = std::sync::Arc::new(services::tasks::TaskManager::new());
    let stream_mgr = std::sync::Arc::new(services::stream::StreamManager::new());

    let mut state = AppState {
        config: config.clone(),
        docker: docker_mgr,
        start_time: std::time::Instant::now(),
        db: db_pool,
        console_mgr,
        scheduler: None,
        automation_jobs,
        task_mgr,
        stream_mgr,
    };

    let scheduler = match services::scheduler::start_scheduler(state.clone()).await {
        Ok(sched) => Some(std::sync::Arc::new(sched)),
        Err(e) => {
            tracing::error!("Failed to start scheduler: {}", e);
            None
        }
    };

    state.scheduler = scheduler;

    let router = create_router(state);

    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    info!("Daemon listening on http://{}", config.bind_addr);

    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await?;

    Ok(())
}
