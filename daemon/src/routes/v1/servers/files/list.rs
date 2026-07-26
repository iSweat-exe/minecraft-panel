use anyhow::Context;
use axum::extract::{Path, Query, State};
use axum::Json;
use protocol::{FileEntry};

use crate::routes::AppState;
use crate::services::auth::UserAuth;

use super::FileQuery;

#[utoipa::path(
    tag = "Server Files",
    summary = "Retrieve a listing of files and directories in a specific server path",
    get,
    path = "/api/v1/servers/{server_id}/files/list",
    params(
        ("server_id" = String, Path, description = "Server ID"),
        ("path" = String, Query, description = "Directory path to list")
    ),
    responses(
        (status = 200, description = "List files", body = inline(protocol::Vec<protocol::FileEntry>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn list_files(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Query(query): Query<FileQuery>,
) -> Result<Json<Vec<FileEntry>>, crate::error::DaemonError> {
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

    match crate::services::files::list_dir(&safe_path)
        .await
        .context(format!("Failed to list directory: {}", query.path))
    {
        Ok(entries) => Ok(Json(entries)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}
