use anyhow::Context;
use axum::extract::Query;
use axum::Json;
use protocol::{ApiResponse, FileActionRequest};

use crate::auth::UserAuth;

use super::FileQuery;

pub async fn file_action(
    auth: UserAuth,
    Query(query): Query<FileQuery>,
    Json(payload): Json<FileActionRequest>,
) -> Json<ApiResponse<String>> {
    if let Err((_, msg)) = auth.require_permission("server:files") {
        return axum::Json(protocol::ApiResponse::err(msg.to_string()));
    }
    match crate::files::perform_action(&query.path, payload.action.clone())
        .await
        .context(format!(
            "Failed to perform file action on target: {}",
            query.path
        )) {
        Ok(_) => Json(ApiResponse::ok("Action executed".to_string())),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
