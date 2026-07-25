use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};

use crate::auth::UserAuth;
use crate::routes::AppState;

use super::FileQuery;

fn error_response(status: StatusCode, msg: String) -> Response {
    Response::builder()
        .status(status)
        .body(Body::from(msg))
        .expect("Building basic status response cannot fail")
}

pub async fn download_file(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Query(query): Query<FileQuery>,
) -> Response {
    if let Err(e) = auth.require_permission("server:files") {
        return e.into_response();
    }
    
    let safe_path = match crate::files::sanitize_path(&server_id, &state.config.data_dir, &query.path) {
        Ok(p) => p,
        Err(e) => return error_response(StatusCode::FORBIDDEN, e.to_string()),
    };

    match crate::files::read_file(&safe_path).await {
        Ok(bytes) => {
            let filename = std::path::Path::new(&query.path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy();

            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/octet-stream")
                .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", filename))
                .body(Body::from(bytes))
                .unwrap_or_else(|e| {
                    error_response(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Failed to build response: {}", e),
                    )
                })
        }
        Err(e) => error_response(StatusCode::NOT_FOUND, e.to_string()),
    }
}
