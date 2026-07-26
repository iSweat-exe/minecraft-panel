use anyhow::Context;
use axum::extract::{Path, Query, State};
use axum::Json;
use protocol::{ApiResponse, FileHashResponse};

use crate::routes::AppState;
use crate::services::auth::UserAuth;

use super::FileQuery;

#[utoipa::path(
    summary = "Hash File",
    get,
    path = "/api/v1/servers/{server_id}/files/hash",
    params(
        ("server_id" = String, Path, description = "Server ID"),
        ("path" = String, Query, description = "File path to hash")
    ),
    responses(
        (status = 200, description = "Hash a single file", body = inline(protocol::ApiResponse<String>))
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
) -> Json<ApiResponse<FileHashResponse>> {
    if let Err(e) = auth.require_permission("server:files") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
    }

    let safe_path = match crate::services::files::sanitize_path(
        &server_id,
        &state.config.data_dir,
        &query.path,
    ) {
        Ok(p) => p,
        Err(e) => return axum::Json(ApiResponse::err(e.to_string())),
    };

    match crate::services::files::hash_file(&safe_path)
        .await
        .context(format!("Failed to hash file: {}", query.path))
    {
        Ok(hash_str) => Json(ApiResponse::ok(FileHashResponse { sha1_hex: hash_str })),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

#[utoipa::path(
    summary = "Hash Multiple",
    post,
    path = "/api/v1/servers/{server_id}/files/hash_multiple",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    request_body = protocol::FileHashMultipleRequest,
    responses(
        (status = 200, description = "Hash multiple files", body = inline(protocol::ApiResponse<protocol::FileHashMultipleResponse>))
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
) -> Json<ApiResponse<protocol::FileHashMultipleResponse>> {
    if let Err(e) = auth.require_permission("server:files") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
    }

    let safe_path = match crate::services::files::sanitize_path(
        &server_id,
        &state.config.data_dir,
        &payload.path,
    ) {
        Ok(p) => p,
        Err(e) => return axum::Json(ApiResponse::err(e.to_string())),
    };

    match crate::services::files::hash_multiple_files(&safe_path, &payload.patterns)
        .await
        .context(format!("Failed to hash files in: {}", payload.path))
    {
        Ok(hashes) => Json(ApiResponse::ok(protocol::FileHashMultipleResponse {
            hashes,
        })),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
