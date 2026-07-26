use anyhow::Context;
use axum::extract::{Path, Query, State};
use axum::Json;
use protocol::{FileHashResponse};

use crate::routes::AppState;
use crate::services::auth::UserAuth;

use super::FileQuery;

#[utoipa::path(
    tag = "Server Files",
    summary = "Calculate the cryptographic hash of a specific file on a server",
    get,
    path = "/api/v1/servers/{server_id}/files/hash",
    params(
        ("server_id" = String, Path, description = "Server ID"),
        ("path" = String, Query, description = "File path to hash")
    ),
    responses(
        (status = 200, description = "Hash a single file", body = inline(protocol::String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn hash_file(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Query(query): Query<FileQuery>,
) -> Result<Json<FileHashResponse>, crate::error::DaemonError> {
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

    match crate::services::files::hash_file(&safe_path)
        .await
        .context(format!("Failed to hash file: {}", query.path))
    {
        Ok(hash_str) => Ok(Json(FileHashResponse { sha1_hex: hash_str })),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}

#[utoipa::path(
    tag = "Server Files",
    summary = "Calculate the cryptographic hashes of multiple files on a server",
    post,
    path = "/api/v1/servers/{server_id}/files/hash_multiple",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    request_body = protocol::FileHashMultipleRequest,
    responses(
        (status = 200, description = "Hash multiple files", body = inline(protocol::FileHashMultipleResponse))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn hash_multiple(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Json(payload): Json<protocol::FileHashMultipleRequest>,
) -> Result<Json<protocol::FileHashMultipleResponse>, crate::error::DaemonError> {
    if let Err(e) = auth.require_permission("server:files") {
        return Err(crate::error::DaemonError::BadRequest(e.to_string()));
    }

    let safe_path = match crate::services::files::sanitize_path(
        &server_id,
        &state.config.data_dir,
        &payload.path,
    ) {
        Ok(p) => p,
        Err(e) => return Err(crate::error::DaemonError::BadRequest(e.to_string())),
    };

    match crate::services::files::hash_multiple_files(&safe_path, &payload.patterns)
        .await
        .context(format!("Failed to hash files in: {}", payload.path))
    {
        Ok(hashes) => Ok(Json(protocol::FileHashMultipleResponse {
            hashes,
        })),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}
