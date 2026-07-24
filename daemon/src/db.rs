use anyhow::{Context, Result};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::env;

pub async fn init_db() -> Result<SqlitePool> {
    // Determine database path
    let db_path = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://daemon.db".to_string());

    use sqlx::sqlite::SqliteConnectOptions;
    use std::str::FromStr;

    let options = SqliteConnectOptions::from_str(&db_path)
        .unwrap_or_else(|_| SqliteConnectOptions::new().filename("daemon.db"))
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
            display_name TEXT
        );

        DROP TABLE IF EXISTS sessions;
        CREATE TABLE sessions (
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
        "#,
    )
    .execute(&pool)
    .await
    .context("Failed to create tables in SQLite database")?;

    // Safe migrations for history table
    sqlx::query("ALTER TABLE history ADD COLUMN user TEXT")
        .execute(&pool)
        .await
        .ok();
    sqlx::query("ALTER TABLE history ADD COLUMN user_id TEXT")
        .execute(&pool)
        .await
        .ok();

    Ok(pool)
}
