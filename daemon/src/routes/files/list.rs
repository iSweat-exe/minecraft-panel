use anyhow::Context;
use axum::extract::Query;
use axum::Json;
use protocol::{ApiResponse, FileEntry};

use crate::auth::UserAuth;

use super::FileQuery;

pub async fn list_files(
    auth: UserAuth,
    Query(query): Query<FileQuery>,
) -> Json<ApiResponse<Vec<FileEntry>>> {
    if let Err((_, msg)) = auth.require_permission("server:files") {
        return Json(ApiResponse::err(msg.to_string()));
    }
    match crate::files::list_dir(&query.path)
        .await
        .context(format!("Failed to list directory: {}", query.path))
    {
        Ok(entries) => Json(ApiResponse::ok(entries)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
