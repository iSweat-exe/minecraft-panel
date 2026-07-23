use anyhow::Context;
use axum::extract::Query;
use axum::Json;
use protocol::{ApiResponse, FileActionRequest};

use crate::auth::NodeAuth;

#[derive(serde::Deserialize)]
pub struct FileQuery {
    pub path: String,
}

pub async fn file_action(
    _auth: NodeAuth,
    Query(query): Query<FileQuery>,
    Json(payload): Json<FileActionRequest>,
) -> Json<ApiResponse<String>> {
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
