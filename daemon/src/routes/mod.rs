pub mod v1;

use std::sync::Arc;

use crate::config::DaemonConfig;
use crate::docker::DockerManager;
use axum::Router;

#[derive(Clone)]
pub struct AppState {
    pub config: DaemonConfig,
    pub docker: DockerManager,
    pub start_time: std::time::Instant,
    pub db: sqlx::SqlitePool,
    pub console_mgr: Arc<crate::console::ConsoleStreamManager>,
    #[allow(dead_code)]
    pub scheduler: Option<Arc<tokio_cron_scheduler::JobScheduler>>,
}


use axum::{
    extract::Request,
    middleware::{self, Next},
    response::{Response, IntoResponse},
    http::StatusCode,
};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Mutex;
use std::time::{Duration, Instant};

type RateLimitState = Arc<Mutex<HashMap<std::net::IpAddr, (u32, Instant)>>>;

async fn rate_limit_middleware(
    axum::Extension(state): axum::Extension<RateLimitState>,
    request: Request,
    next: Next,
) -> Response {
    // Manually extract IP to avoid trait bound errors with from_fn
    let ip = request.extensions()
        .get::<axum::extract::ConnectInfo<SocketAddr>>()
        .map(|c| c.0.ip())
        .unwrap_or_else(|| std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1)));
        
    {
        let mut map = state.lock().unwrap_or_else(|e| e.into_inner());
        let entry = map.entry(ip).or_insert_with(|| (0, Instant::now()));
        
        // Reset counter every 1 minute
        if entry.1.elapsed() > Duration::from_secs(60) {
            entry.0 = 0;
            entry.1 = Instant::now();
        }
        
        // Allow up to 1000 requests per minute per IP
        if entry.0 > 1000 {
            return (StatusCode::TOO_MANY_REQUESTS, "Too many requests").into_response();
        }
        
        entry.0 += 1;
    }
    
    next.run(request).await.into_response()
}

pub fn create_router(state: AppState) -> Router {
    let rate_limit_state: RateLimitState = Arc::new(Mutex::new(HashMap::new()));

    let cleanup_state = rate_limit_state.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(300)).await;
            if let Ok(mut map) = cleanup_state.lock() {
                map.retain(|_, (_, last_seen)| last_seen.elapsed() <= Duration::from_secs(60));
            }
        }
    });

    Router::new()
        .merge(v1::router())
        .layer(middleware::from_fn(rate_limit_middleware))
        .layer(axum::Extension(rate_limit_state))
        .layer(axum::Extension(state.config.clone()))
        .with_state(state)
}
