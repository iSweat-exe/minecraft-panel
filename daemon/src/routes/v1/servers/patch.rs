use anyhow::Context;
use axum::extract::{Path, State};
use axum::Json;
use protocol::{docker::ServerSpec, ApiResponse, PatchServerRequest};

use crate::error::DaemonError;
use crate::routes::AppState;
use crate::services::auth::UserAuth;

pub async fn patch_server(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Json(payload): Json<PatchServerRequest>,
) -> Result<Json<ApiResponse<String>>, DaemonError> {
    auth.require_permission("servers.update")?;
    tracing::info!(server_id = %server_id, user = %auth.username, "Patching server configuration");
    // 1. Charger le Spec existant
    let (spec_json, spec_version): (String, i64) =
        sqlx::query_as("SELECT spec_json, spec_version FROM servers WHERE id = ?")
            .bind(&server_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| DaemonError::NotFound("Server not found in database".into()))?;

    let mut spec: ServerSpec =
        serde_json::from_str(&spec_json).context("Failed to deserialize ContainerSpec")?;

    // 2. Appliquer les modifications partielles
    if let Some(name) = payload.name {
        spec.name = name;
    }
    if let Some(image) = payload.image {
        spec.image = image;
    }
    if let Some(env) = payload.env {
        spec.env = env;
    }
    if let Some(ports) = payload.ports {
        spec.ports = ports;
    }
    if let Some(volumes) = payload.volumes {
        spec.volumes = volumes;
    }
    if let Some(resources) = payload.resources {
        spec.resources = resources;
    }
    if let Some(owner) = payload.owner {
        spec.owner = Some(owner);
    }

    // 3. Valider les ports et mettre à jour `server_allocations`
    let mut tx = state.db.begin().await?;

    sqlx::query("DELETE FROM server_allocations WHERE server_id = ?")
        .bind(&server_id)
        .execute(&mut *tx)
        .await?;

    super::allocate_server_ports(&mut tx, &server_id, &spec.ports).await?; // 4. Mettre à jour `servers` (incrémenter `spec_version`)
    let new_spec_json = serde_json::to_string(&spec).context("Failed to serialize updated spec")?;
    sqlx::query("UPDATE servers SET spec_json = ?, spec_version = ? WHERE id = ?")
        .bind(&new_spec_json)
        .bind(spec_version + 1)
        .bind(&server_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    // 5. Mettre à jour Docker (Stop, Remove, Create)
    match state
        .docker
        .remove_container(&server_id)
        .await
        .context(format!(
            "Failed to remove old server container {}",
            server_id
        )) {
        Ok(_) => {}
        Err(e) => {
            tracing::warn!("Could not remove container during patch: {}", e);
        }
    }

    match state
        .docker
        .create_server_container(&spec)
        .await
        .context("Failed to create patched server container")
    {
        Ok(container_id) => {
            tracing::info!(server_id = %server_id, spec_version = spec_version + 1, "Serveur mis à jour (PATCH) avec succès");
            Ok(Json(ApiResponse::ok(container_id)))
        }
        Err(e) => Err(DaemonError::Anyhow(e)),
    }
}
