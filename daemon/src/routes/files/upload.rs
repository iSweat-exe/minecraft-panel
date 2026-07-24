use anyhow::Context;
use axum::{body::Bytes, extract::Query, Json};
use protocol::ApiResponse;

use crate::auth::NodeAuth;

#[derive(serde::Deserialize)]
pub struct FileQuery {
    pub path: String,
}

pub async fn upload_file(
    _auth: NodeAuth,
    Query(query): Query<FileQuery>,
    body: Bytes,
) -> Json<ApiResponse<String>> {
    let content = body.to_vec();
    match crate::files::write_file(&query.path, &content)
        .await
        .context(format!("Failed to write file to: {}", query.path))
    {
        Ok(_) => Json(ApiResponse::ok("File uploaded".to_string())),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
