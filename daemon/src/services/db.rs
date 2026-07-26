use anyhow::{Context, Result};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::env;

pub async fn init_db() -> Result<SqlitePool> {
    // Determine database path
    let default_path = ".panel_users/daemon.db";
    let db_path = env::var("DATABASE_URL").unwrap_or_else(|_| format!("sqlite://{}", default_path));

    // Ensure the directory exists if we are using the default path
    if db_path.starts_with("sqlite://.panel_users/") {
        let _ = std::fs::create_dir_all(".panel_users");
    }

    use sqlx::sqlite::SqliteConnectOptions;
    use std::str::FromStr;

    let options = SqliteConnectOptions::from_str(&db_path)
        .unwrap_or_else(|_| SqliteConnectOptions::new().filename(default_path))
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .context("Failed to connect to SQLite database")?;

    // Create tables
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            uuid TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            permissions TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            password_hash TEXT,
            avatar_base64 TEXT,
            display_name TEXT,
            is_superadmin INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS sessions (
            uuid TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            avatar TEXT,
            connected_at INTEGER NOT NULL,
            last_seen INTEGER NOT NULL,
            ip TEXT NOT NULL,
            ipv6 TEXT,
            location TEXT NOT NULL,
            os TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            user_uuid TEXT,
            action TEXT NOT NULL,
            details TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            FOREIGN KEY(user_uuid) REFERENCES users(uuid) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS automations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            cron_expr TEXT NOT NULL,
            action_type TEXT NOT NULL,
            target_server TEXT,
            payload TEXT,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS server_allocations (
            server_id TEXT NOT NULL,
            host_ip TEXT NOT NULL,
            host_port INTEGER NOT NULL,
            UNIQUE(host_ip, host_port)
        );

        CREATE TABLE IF NOT EXISTS servers (
            id TEXT PRIMARY KEY,
            spec_json TEXT NOT NULL,
            spec_version INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS server_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            cpu_percent REAL NOT NULL,
            memory_used_bytes INTEGER NOT NULL,
            memory_limit_bytes INTEGER NOT NULL,
            disk_used_bytes INTEGER DEFAULT 0,
            network_rx_bytes INTEGER DEFAULT 0,
            network_tx_bytes INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_server_metrics_time ON server_metrics(server_id, timestamp);
        "#,
    )
    .execute(&pool)
    .await
    .context("Failed to create tables in SQLite database")?;

    // Safe column migrations with explicit duplicate column check
    for alter_query in [
        "ALTER TABLE history ADD COLUMN user TEXT",
        "ALTER TABLE history ADD COLUMN user_id TEXT",
        "ALTER TABLE users ADD COLUMN is_superadmin INTEGER DEFAULT 0",
        "ALTER TABLE server_metrics ADD COLUMN network_rx_bytes INTEGER DEFAULT 0",
        "ALTER TABLE server_metrics ADD COLUMN network_tx_bytes INTEGER DEFAULT 0",
    ] {
        if let Err(e) = sqlx::query(alter_query).execute(&pool).await {
            let msg = e.to_string();
            if !msg.contains("duplicate column name") && !msg.contains("duplicate column") {
                tracing::warn!("Migration notice for '{}': {}", alter_query, msg);
            }
        }
    }

    // Seed the root admin user if it doesn't exist
    let root_exists =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE is_superadmin = 1")
            .fetch_one(&pool)
            .await
            .unwrap_or(0);

    if root_exists == 0 {
        let root_uuid = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();
        // Default password: "changeme" — must be changed on first login
        let default_hash =
            bcrypt::hash("changeme", bcrypt::DEFAULT_COST).unwrap_or_else(|_| String::new());
        sqlx::query(
            "INSERT INTO users (uuid, username, role, permissions, created_at, password_hash, display_name, is_superadmin) VALUES (?, 'admin', 'admin', '[\"*\"]', ?, ?, 'Administrator', 1)"
        )
        .bind(&root_uuid)
        .bind(now)
        .bind(&default_hash)
        .execute(&pool)
        .await
        .context("Failed to seed root admin user")?;
        tracing::info!("Root admin user 'admin' created with default password 'changeme'");
    }

    Ok(pool)
}

pub async fn backfill_unmanaged_containers(
    pool: &SqlitePool,
    docker_mgr: &crate::services::docker::DockerManager,
    managed_containers: &[protocol::ServerStatusResponse],
) -> Result<usize> {
    tracing::info!("Starting database backfill check for unmanaged containers...");
    let mut backfill_count = 0;
    for server in managed_containers {
        let exists = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM servers WHERE id = ?")
            .bind(&server.server_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

        if exists == 0 {
            tracing::info!(server_id = %server.server_id, "Found managed container without SQLite record. Reconstructing spec for backfill...");
            if let Ok(spec) = docker_mgr.reconstruct_spec(&server.server_id).await {
                if let Ok(spec_json) = serde_json::to_string(&spec) {
                    let res = sqlx::query(
                        "INSERT INTO servers (id, spec_json, spec_version) VALUES (?, ?, ?)",
                    )
                    .bind(&server.server_id)
                    .bind(&spec_json)
                    .bind(1)
                    .execute(pool)
                    .await;

                    if res.is_ok() {
                        backfill_count += 1;
                    } else {
                        tracing::error!(server_id = %server.server_id, "Failed to insert reconstructed spec into database");
                    }
                }
            } else {
                tracing::error!(server_id = %server.server_id, "Failed to reconstruct spec from Docker container");
            }
        }
    }

    if backfill_count > 0 {
        tracing::info!("Backfilled {} servers into SQLite", backfill_count);
    }

    Ok(backfill_count)
}
