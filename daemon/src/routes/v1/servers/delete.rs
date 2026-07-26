use anyhow::Context;
use axum::extract::{Path, State};
use axum::Json;

use crate::error::DaemonError;
use crate::routes::AppState;
use crate::services::auth::UserAuth;

#[utoipa::path(
    tag = "Servers",
    summary = "Permanently delete a server and its associated data",
    delete,
    path = "/api/v1/servers/{server_id}",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    responses(
        (status = 200, description = "Delete a server", body = inline(protocol::String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_server(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
) -> Result<Json<String>, DaemonError> {
    auth.require_permission("servers.delete")?;
    tracing::warn!(server_id = %server_id, user = %auth.username, "Server deletion requested");

    match state
        .docker
        .remove_container(&server_id)
        .await
        .context(format!("Failed to remove server {}", server_id))
    {
        Ok(_) => {
            tracing::warn!(server_id = %server_id, "Action sensible: suppression du serveur (Docker)");

            let mut tx = state.db.begin().await?;

            sqlx::query("DELETE FROM server_allocations WHERE server_id = ?")
                .bind(&server_id)
                .execute(&mut *tx)
                .await?;

            sqlx::query("DELETE FROM servers WHERE id = ?")
                .bind(&server_id)
                .execute(&mut *tx)
                .await?;

            tx.commit().await?;

            Ok(Json(format!(
                "Server {} removed",
                server_id
            )))
        }
        Err(e) => Err(DaemonError::Anyhow(e)),
    }
}
