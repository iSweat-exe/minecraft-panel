use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};

use crate::routes::AppState;
use crate::services::auth::UserAuth;

use super::FileQuery;

fn error_response(status: StatusCode, msg: String) -> Response {
    Response::builder()
        .status(status)
        .body(Body::from(msg))
        .expect("Building basic status response cannot fail")
}

#[utoipa::path(
    summary = "Download File",
    get,
    path = "/api/v1/servers/{server_id}/files/download",
    params(
        ("server_id" = String, Path, description = "Server ID"),
        ("path" = String, Query, description = "File path to download")
    ),
    responses(
        (status = 200, description = "Download file stream")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn download_file(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Query(query): Query<FileQuery>,
) -> Response {
    if let Err(e) = auth.require_permission("server:files") {
        return e.into_response();
    }

    let safe_path = match crate::services::files::sanitize_path(
        &server_id,
        &state.config.data_dir,
        &query.path,
    ) {
        Ok(p) => p,
        Err(e) => return error_response(StatusCode::FORBIDDEN, e.to_string()),
    };

    if let Ok(file) = tokio::fs::File::open(&safe_path).await {
        let filename = std::path::Path::new(&query.path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy();

        let stream = tokio_util::io::ReaderStream::new(file);
        let body = Body::from_stream(stream);

        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/octet-stream")
            .header(
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{}\"", filename),
            )
            .body(body)
            .unwrap_or_else(|e| {
                error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to build response: {}", e),
                )
            })
    } else {
        error_response(StatusCode::NOT_FOUND, "File not found".to_string())
    }
}
