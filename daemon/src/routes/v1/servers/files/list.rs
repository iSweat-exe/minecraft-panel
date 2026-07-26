use anyhow::Context;
use axum::extract::{Path, Query, State};
use axum::Json;
use protocol::{ApiResponse, FileEntry};

use crate::routes::AppState;
use crate::services::auth::UserAuth;

use super::FileQuery;

pub async fn list_files(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Query(query): Query<FileQuery>,
) -> Json<ApiResponse<Vec<FileEntry>>> {
    if let Err(e) = auth.require_permission("server:files") {
        return Json(ApiResponse::err(e.to_string()));
    }

    let safe_path = match crate::services::files::sanitize_path(
        &server_id,
        &state.config.data_dir,
        &query.path,
    ) {
        Ok(p) => p,
        Err(e) => return axum::Json(ApiResponse::err(e.to_string())),
    };

    match crate::services::files::list_dir(&safe_path)
        .await
        .context(format!("Failed to list directory: {}", query.path))
    {
        Ok(entries) => Json(ApiResponse::ok(entries)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
