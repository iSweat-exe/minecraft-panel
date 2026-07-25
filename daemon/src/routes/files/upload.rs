use anyhow::Context;
use axum::{body::Bytes, extract::Query, Json};
use protocol::ApiResponse;

use crate::auth::UserAuth;

use super::FileQuery;

pub async fn upload_file(
    auth: UserAuth,
    Query(query): Query<FileQuery>,
    body: Bytes,
) -> Json<ApiResponse<String>> {
    if let Err((_, msg)) = auth.require_permission("server:files") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    let content = body.to_vec();
    match crate::files::write_file(&query.path, &content)
        .await
        .context(format!("Failed to write file to: {}", query.path))
    {
        Ok(_) => Json(ApiResponse::ok("File uploaded".to_string())),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
