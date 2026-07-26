use axum::{
    extract::{Path, Query, State},
    Json,
};
use protocol::ApiResponse;
use tokio::io::AsyncWriteExt;
use futures_util::StreamExt;

use crate::routes::AppState;
use crate::services::auth::UserAuth;

use super::FileQuery;

pub async fn upload_file(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
    Query(query): Query<FileQuery>,
    body: axum::body::Body,
) -> Json<ApiResponse<String>> {
    if let Err(e) = auth.require_permission("server:files") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
    }

    let safe_path = match crate::services::files::sanitize_path(
        &server_id,
        &state.config.data_dir,
        &query.path,
    ) {
        Ok(p) => p,
        Err(e) => return axum::Json(ApiResponse::err(e.to_string())),
    };

    let mut file = match tokio::fs::File::create(&safe_path).await {
        Ok(f) => f,
        Err(e) => return Json(ApiResponse::err(format!("Failed to create file: {}", e))),
    };

    let mut stream = body.into_data_stream();

    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(data) => {
                if let Err(e) = file.write_all(&data).await {
                    let _ = tokio::fs::remove_file(&safe_path).await; // Clean up partial file
                    return Json(ApiResponse::err(format!("Failed to write to file: {}", e)));
                }
            }
            Err(e) => {
                let _ = tokio::fs::remove_file(&safe_path).await;
                return Json(ApiResponse::err(format!("Failed to read stream: {}", e)));
            }
        }
    }

    Json(ApiResponse::ok("File uploaded".to_string()))
}
