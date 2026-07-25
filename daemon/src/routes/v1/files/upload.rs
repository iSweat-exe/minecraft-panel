use anyhow::Context;
use axum::{body::Bytes, extract::{Path, Query, State}, Json};
use protocol::ApiResponse;

use crate::auth::UserAuth;
use crate::routes::AppState;

use super::FileQuery;

pub async fn upload_file(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Query(query): Query<FileQuery>,
    body: Bytes,
) -> Json<ApiResponse<String>> {
    if let Err(e) = auth.require_permission("server:files") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
    }
    
    let safe_path = match crate::files::sanitize_path(&server_id, &state.config.data_dir, &query.path) {
        Ok(p) => p,
        Err(e) => return axum::Json(ApiResponse::err(e.to_string())),
    };

    let content = body.to_vec();
    match crate::files::write_file(&safe_path, &content)
        .await
        .context(format!("Failed to write file to: {}", query.path))
    {
        Ok(_) => Json(ApiResponse::ok("File uploaded".to_string())),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
