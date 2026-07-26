use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};

use thiserror::Error;

#[derive(Error, Debug)]
pub enum DaemonError {
    #[error("Database error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Internal error: {0}")]
    Anyhow(#[from] anyhow::Error),
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    #[error("Forbidden: {0}")]
    Forbidden(String),
    #[error("Bad request: {0}")]
    BadRequest(String),
    #[error("Not found: {0}")]
    NotFound(String),
}

impl IntoResponse for DaemonError {
    fn into_response(self) -> Response {
        let (status, msg) = match &self {
            DaemonError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg.clone()),
            DaemonError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg.clone()),
            DaemonError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            DaemonError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            DaemonError::Sqlx(_) | DaemonError::Io(_) | DaemonError::Anyhow(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, format!("{:#}", self))
            }
        };

        (
            status,
            Json(protocol::ApiErrorResponse {
                error: msg,
            }),
        )
            .into_response()
    }
}
