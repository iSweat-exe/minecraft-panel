use axum::{
    extract::{Path, State},
    Json,
};
use protocol::{ApiResponse, DockerImageInfo};

use crate::{services::auth::UserAuth, AppState};

#[utoipa::path(
    summary = "List All Images",
    get,
    path = "/api/v1/docker/images",
    responses(
        (status = 200, description = "List all docker images", body = inline(ApiResponse<Vec<DockerImageInfo>>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
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

#[derive(serde::Deserialize, utoipa::ToSchema)]
pub struct PullImagePayload {
    pub image_name: String,
}

#[utoipa::path(
    summary = "Pull Image",
    post,
    path = "/api/v1/docker/images/pull",
    request_body = PullImagePayload,
    responses(
        (status = 200, description = "Pull a docker image", body = inline(ApiResponse<String>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
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

#[utoipa::path(
    summary = "Remove Image",
    delete,
    path = "/api/v1/docker/images/{id}",
    params(
        ("id" = String, Path, description = "Image ID")
    ),
    responses(
        (status = 200, description = "Remove a docker image", body = inline(ApiResponse<String>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
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
