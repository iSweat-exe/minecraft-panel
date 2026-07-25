use axum::{
    body::Body,
    extract::Query,
    http::{header, StatusCode},
    response::Response,
};

use crate::auth::UserAuth;

use super::FileQuery;

pub async fn download_file(
    auth: UserAuth,
    Query(query): Query<FileQuery>,
) -> Response {
    if let Err((_, msg)) = auth.require_permission("server:files") {
        return Response::builder()
            .status(StatusCode::FORBIDDEN)
            .body(Body::from(msg.to_string()))
            .unwrap_or_else(|_| Response::builder().status(500).body(Body::empty()).unwrap());
    }
    match crate::files::read_file(&query.path).await {
        Ok(bytes) => {
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/octet-stream")
                .header(header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", std::path::Path::new(&query.path).file_name().unwrap_or_default().to_string_lossy()))
                .body(Body::from(bytes))
                .unwrap_or_else(|e| {
                    Response::builder()
                        .status(StatusCode::INTERNAL_SERVER_ERROR)
                        .body(Body::from(format!("Failed to build response: {}", e)))
                        .unwrap()
                })
        }
        Err(e) => {
            Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(Body::from(e.to_string()))
                .unwrap_or_else(|_| Response::builder().status(500).body(Body::empty()).unwrap())
        }
    }
}
