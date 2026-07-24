use axum::{
    body::Body,
    extract::Query,
    http::{header, StatusCode},
    response::Response,
};

use crate::auth::NodeAuth;

#[derive(serde::Deserialize)]
pub struct FileQuery {
    pub path: String,
}

pub async fn download_file(
    _auth: NodeAuth,
    Query(query): Query<FileQuery>,
) -> Response {
    match crate::files::read_file(&query.path).await {
        Ok(bytes) => {
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/octet-stream")
                .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", std::path::Path::new(&query.path).file_name().unwrap_or_default().to_string_lossy()))
                .body(Body::from(bytes))
                .unwrap()
        }
        Err(e) => {
            Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(Body::from(e.to_string()))
                .unwrap()
        }
    }
}
