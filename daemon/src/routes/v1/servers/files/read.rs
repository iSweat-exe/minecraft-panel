use anyhow::Context;
use axum::extract::{Path, Query, State};
use axum::http::{header, StatusCode};
use axum::response::IntoResponse;
use axum::Json;

use crate::routes::AppState;
use crate::services::auth::UserAuth;

use super::FileQuery;

#[utoipa::path(
    tag = "Server Files",
    summary = "Read the text contents of a specific file on a server",
    get,
    path = "/api/v1/servers/{server_id}/files/read",
    params(
        ("server_id" = String, Path, description = "Server ID"),
        ("path" = String, Query, description = "File path to read")
    ),
    responses(
        (status = 200, description = "Read file", body = inline(protocol::String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn read_file(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Query(query): Query<FileQuery>,
) -> impl IntoResponse {
    if let Err(e) = auth.require_permission("server:files") {
        return e.into_response();
    }

    let safe_path = match crate::services::files::sanitize_path(
        &server_id,
        &state.config.data_dir,
        &query.path,
    ) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::FORBIDDEN,
                Json(protocol::ApiErrorResponse { error: e.to_string() }),
            )
                .into_response()
        }
    };

    match crate::services::files::read_file(&safe_path)
        .await
        .context(format!("Failed to read file: {}", query.path))
    {
        Ok(data) => (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "application/octet-stream")],
            data,
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(protocol::ApiErrorResponse { error: format!("{:#}", e) }),
        )
            .into_response(),
    }
}
