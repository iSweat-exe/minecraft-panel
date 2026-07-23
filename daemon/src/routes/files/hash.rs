use anyhow::Context;
use axum::extract::Query;
use axum::Json;
use protocol::{ApiResponse, FileHashResponse};

use crate::auth::NodeAuth;

#[derive(serde::Deserialize)]
pub struct FileQuery {
    pub path: String,
}

pub async fn hash_file(
    _auth: NodeAuth,
    Query(query): Query<FileQuery>,
) -> Json<ApiResponse<FileHashResponse>> {
    match crate::files::hash_file(&query.path)
        .await
        .context(format!("Failed to hash file: {}", query.path))
    {
        Ok(hash_str) => Json(ApiResponse::ok(FileHashResponse { sha1_hex: hash_str })),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
