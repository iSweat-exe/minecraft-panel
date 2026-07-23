use anyhow::Context;
use axum::extract::Query;
use axum::http::{header, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use protocol::ApiResponse;

use crate::auth::NodeAuth;

#[derive(serde::Deserialize)]
pub struct FileQuery {
    pub path: String,
}

pub async fn read_file(_auth: NodeAuth, Query(query): Query<FileQuery>) -> impl IntoResponse {
    match crate::files::read_file(&query.path)
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
            Json(ApiResponse::<()>::err(format!("{:#}", e))),
        )
            .into_response(),
    }
}
