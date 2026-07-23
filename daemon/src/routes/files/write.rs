use anyhow::Context;
use axum::extract::Query;
use axum::Json;
use protocol::{ApiResponse, FileWriteRequest};

use crate::auth::NodeAuth;

#[derive(serde::Deserialize)]
pub struct FileQuery {
    pub path: String,
}

pub async fn write_file(
    _auth: NodeAuth,
    Query(query): Query<FileQuery>,
    Json(payload): Json<FileWriteRequest>,
) -> Json<ApiResponse<String>> {
    let content = payload.content.into_bytes();
    match crate::files::write_file(&query.path, &content)
        .await
        .context(format!("Failed to write file to: {}", query.path))
    {
        Ok(_) => Json(ApiResponse::ok("File saved".to_string())),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
