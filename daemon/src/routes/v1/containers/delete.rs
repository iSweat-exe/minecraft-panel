use anyhow::Context;
use axum::extract::{Path, State};
use axum::Json;
use protocol::ApiResponse;

use crate::auth::UserAuth;
use crate::routes::AppState;
use crate::error::DaemonError;

pub async fn delete_server(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
) -> Result<Json<ApiResponse<String>>, DaemonError> {
    auth.require_permission("servers.delete")?;

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

            Ok(Json(ApiResponse::ok(format!("Server {} removed", server_id))))
        },
        Err(e) => Err(DaemonError::Anyhow(e)),
    }
}
