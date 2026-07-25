use axum::{
    response::{IntoResponse, Response},
    Json,
};
use protocol::ApiResponse;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DaemonError {
    #[error("Database error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Internal error: {0}")]
    Anyhow(#[from] anyhow::Error),
    #[error("{0}")]
    Custom(String),
}

impl IntoResponse for DaemonError {
    fn into_response(self) -> Response {
        let msg = self.to_string();
        // You can log the error here if needed
        // log::error!("Daemon API Error: {}", msg);
        
        Json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some(msg),
        })
        .into_response()
    }
}
