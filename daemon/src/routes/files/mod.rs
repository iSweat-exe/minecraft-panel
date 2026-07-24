pub mod action;
pub mod hash;
pub mod list;
pub mod read;
pub mod write;

use crate::routes::AppState;
use axum::routing::{get, post};
use axum::Router;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/files/list", get(list::list_files))
        .route("/api/v1/files/read", get(read::read_file))
        .route("/api/v1/files/write", post(write::write_file))
        .route("/api/v1/files/action", post(action::file_action))
        .route("/api/v1/files/hash", get(hash::hash_file))
        .route("/api/v1/files/hash_multiple", post(hash::hash_multiple))
}
