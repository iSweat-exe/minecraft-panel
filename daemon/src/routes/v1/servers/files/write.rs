use anyhow::Context;
use axum::extract::{Path, Query, State};
use axum::Json;
use protocol::{FileWriteRequest};

use crate::routes::AppState;
use crate::services::auth::UserAuth;

use super::FileQuery;

#[utoipa::path(
    tag = "Server Files",
    summary = "Write or overwrite the text contents of a specific file on a server",
    post,
    path = "/api/v1/servers/{server_id}/files/write",
    params(
        ("server_id" = String, Path, description = "Server ID"),
        ("path" = String, Query, description = "File path to write")
    ),
    request_body(content = String, description = "File content"),
    responses(
        (status = 200, description = "Write file", body = inline(protocol::String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn write_file(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Query(query): Query<FileQuery>,
    Json(payload): Json<FileWriteRequest>,
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

    let content = payload.content.into_bytes();
    match crate::services::files::write_file(&safe_path, &content)
        .await
        .context(format!("Failed to write file to: {}", query.path))
    {
        Ok(_) => Ok(Json("File saved".to_string())),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}
