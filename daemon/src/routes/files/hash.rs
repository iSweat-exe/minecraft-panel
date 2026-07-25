use anyhow::Context;
use axum::extract::Query;
use axum::Json;
use protocol::{ApiResponse, FileHashResponse};

use crate::auth::UserAuth;

use super::FileQuery;

pub async fn hash_file(
    auth: UserAuth,
    Query(query): Query<FileQuery>,
) -> Json<ApiResponse<FileHashResponse>> {
    if let Err((_, msg)) = auth.require_permission("server:files") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    match crate::files::hash_file(&query.path)
        .await
        .context(format!("Failed to hash file: {}", query.path))
    {
        Ok(hash_str) => Json(ApiResponse::ok(FileHashResponse { sha1_hex: hash_str })),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn hash_multiple(
    auth: UserAuth,
    Json(payload): Json<protocol::FileHashMultipleRequest>,
) -> Json<ApiResponse<protocol::FileHashMultipleResponse>> {
    if let Err((_, msg)) = auth.require_permission("server:files") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    match crate::files::hash_multiple_files(&payload.path, &payload.patterns)
        .await
        .context(format!("Failed to hash files in: {}", payload.path))
    {
        Ok(hashes) => Json(ApiResponse::ok(protocol::FileHashMultipleResponse {
            hashes,
        })),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
