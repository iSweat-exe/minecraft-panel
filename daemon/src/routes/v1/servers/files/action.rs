use anyhow::Context;
use axum::extract::{Path, Query, State};
use axum::Json;
use protocol::{ApiResponse, FileActionRequest};

use crate::routes::AppState;
use crate::services::auth::UserAuth;

use super::FileQuery;

pub async fn file_action(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Query(query): Query<FileQuery>,
    Json(payload): Json<FileActionRequest>,
) -> Json<ApiResponse<String>> {
    if let Err(e) = auth.require_permission("server:files") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
    }

    let safe_path = match crate::services::files::sanitize_path(
        &server_id,
        &state.config.data_dir,
        &query.path,
    ) {
        Ok(p) => p,
        Err(e) => return axum::Json(ApiResponse::err(e.to_string())),
    };

    match crate::services::files::perform_action(
        &safe_path,
        payload.action.clone(),
        &state.config.data_dir,
        &server_id,
    )
    .await
    .context(format!(
        "Failed to perform file action on target: {}",
        query.path
    )) {
        Ok(_) => Json(ApiResponse::ok("Action executed".to_string())),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
