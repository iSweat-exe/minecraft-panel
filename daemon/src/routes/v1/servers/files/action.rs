use anyhow::Context;
use axum::extract::{Path, Query, State};
use axum::Json;
use protocol::{FileActionRequest};

use crate::routes::AppState;
use crate::services::auth::UserAuth;

use super::FileQuery;

#[utoipa::path(
    tag = "Server Files",
    summary = "Perform a file operation (copy, move, rename, delete) on a server",
    post,
    path = "/api/v1/servers/{server_id}/files/action",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    request_body = protocol::FileActionRequest,
    responses(
        (status = 200, description = "Perform file action", body = inline(protocol::String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn file_action(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Query(query): Query<FileQuery>,
    Json(payload): Json<FileActionRequest>,
) -> Result<Json<String>, crate::error::DaemonError> {
    if let Err(e) = auth.require_permission("server:files") {
        return Err(crate::error::DaemonError::BadRequest(e.to_string()));
    }

    let safe_path = match crate::services::files::sanitize_path(
        &server_id,
        &state.config.data_dir,
        &query.path,
    ) {
        Ok(p) => p,
        Err(e) => return Err(crate::error::DaemonError::BadRequest(e.to_string())),
    };

    match crate::services::files::perform_action(
        &safe_path,
        payload.action.clone(),
        &state.config.data_dir,
        &server_id,
    )
    .await
    .context(format!(
        "Failed to perform file action on target: {}",
        query.path
    )) {
        Ok(_) => Ok(Json("Action executed".to_string())),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}
