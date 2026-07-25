use anyhow::Context;
use axum::extract::Query;
use axum::Json;
use protocol::{ApiResponse, FileWriteRequest};

use crate::auth::UserAuth;

use super::FileQuery;

pub async fn write_file(
    auth: UserAuth,
    Query(query): Query<FileQuery>,
    Json(payload): Json<FileWriteRequest>,
) -> Json<ApiResponse<String>> {
    if let Err((_, msg)) = auth.require_permission("server:files") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    let content = payload.content.into_bytes();
    match crate::files::write_file(&query.path, &content)
        .await
        .context(format!("Failed to write file to: {}", query.path))
    {
        Ok(_) => Json(ApiResponse::ok("File saved".to_string())),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
