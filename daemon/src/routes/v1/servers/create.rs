use anyhow::Context;
use axum::extract::State;
use axum::Json;
use protocol::{ApiResponse, CreateServerRequest};

use crate::error::DaemonError;
use crate::routes::AppState;
use crate::services::auth::UserAuth;

#[utoipa::path(
    post,
    path = "/api/v1/servers",
    request_body = protocol::ServerSpec,
    responses(
        (status = 200, description = "Create a server", body = inline(protocol::ApiResponse<String>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_server(
    auth: UserAuth,
    State(state): State<AppState>,
    Json(payload): Json<CreateServerRequest>,
) -> Result<Json<ApiResponse<String>>, DaemonError> {
    auth.require_permission("servers.create")?;
    tracing::info!(
        user = %auth.username,
        server_id = %payload.spec.server_id,
        image = %payload.spec.image,
        "Creating new server"
    );

    let mut tx = state.db.begin().await?;

    super::allocate_server_ports(&mut tx, &payload.spec.server_id, &payload.spec.ports).await?;

    let spec_json = serde_json::to_string(&payload.spec)
        .context("Failed to serialize ContainerSpec for database insertion")?;

    sqlx::query("INSERT INTO servers (id, spec_json, spec_version) VALUES (?, ?, ?)")
        .bind(&payload.spec.server_id)
        .bind(&spec_json)
        .bind(1)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    match state
        .docker
        .create_server_container(&payload.spec)
        .await
        .context("Failed to create server container")
    {
        Ok(container_id) => Ok(Json(ApiResponse::ok(container_id))),
        Err(e) => {
            let _ = sqlx::query("DELETE FROM server_allocations WHERE server_id = ?")
                .bind(&payload.spec.server_id)
                .execute(&state.db)
                .await;

            Err(DaemonError::Anyhow(e))
        }
    }
}
