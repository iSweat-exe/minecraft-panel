use axum::{
    extract::{Path, State},
    Json,
};
use protocol::{ApiResponse, DockerImageInfo};

use crate::{auth::UserAuth, AppState};

pub async fn list_all_images(
    auth: UserAuth,
    State(state): State<AppState>,
) -> Json<ApiResponse<Vec<DockerImageInfo>>> {
    if let Err(e) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
    }
    match state.docker.list_all_images().await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

#[derive(serde::Deserialize)]
pub struct PullImagePayload {
    pub image_name: String,
}

pub async fn pull_image(
    auth: UserAuth,
    State(state): State<AppState>,
    Json(payload): Json<PullImagePayload>,
) -> Json<ApiResponse<String>> {
    if let Err(e) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
    }
    match state
        .docker
        .run_docker_command(&["pull", &payload.image_name])
        .await
    {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}

pub async fn remove_image(
    auth: UserAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Json<ApiResponse<String>> {
    if let Err(e) = auth.require_permission("system:docker") {
        return axum::Json(protocol::ApiResponse::err(e.to_string()));
    }
    match state.docker.run_docker_command(&["rmi", "-f", &id]).await {
        Ok(v) => Json(ApiResponse::ok(v)),
        Err(e) => Json(ApiResponse::err(format!("{:#}", e))),
    }
}
