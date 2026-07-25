pub mod action;
pub mod hash;
pub mod list;
pub mod read;
pub mod write;
pub mod upload;
pub mod download;

use crate::routes::AppState;
use axum::routing::{get, post};
use axum::Router;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct FileQuery {
    pub path: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/servers/{server_id}/files/list", get(list::list_files))
        .route("/api/v1/servers/{server_id}/files/read", get(read::read_file))
        .route("/api/v1/servers/{server_id}/files/write", post(write::write_file))
        .route("/api/v1/servers/{server_id}/files/upload", post(upload::upload_file).layer(axum::extract::DefaultBodyLimit::disable()))
        .route("/api/v1/servers/{server_id}/files/download", get(download::download_file))
        .route("/api/v1/servers/{server_id}/files/action", post(action::file_action))
        .route("/api/v1/servers/{server_id}/files/hash", get(hash::hash_file))
        .route("/api/v1/servers/{server_id}/files/hash_multiple", post(hash::hash_multiple))
}
