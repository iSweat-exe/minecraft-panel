use anyhow::Context;
use axum::extract::Query;
use axum::Json;
use protocol::{ApiResponse, FileEntry};

use crate::auth::NodeAuth;

#[derive(serde::Deserialize)]
pub struct FileQuery {
    pub path: String,
}

pub async fn list_files(
    _auth: NodeAuth,
    Query(query): Query<FileQuery>,
) -> Json<ApiResponse<Vec<FileEntry>>> {
    match crate::files::list_dir(&query.path)
        .await
        .context(format!("Failed to list directory: {}", query.path))
    {
        Ok(entries) => Json(ApiResponse::ok(entries)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
