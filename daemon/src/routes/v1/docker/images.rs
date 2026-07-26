use axum::{
    extract::{Path, State},
    Json,
};
use protocol::{DockerImageInfo};

use crate::{services::auth::UserAuth, AppState};

#[utoipa::path(
    tag = "Docker",
    summary = "Retrieve a list of all Docker images available on the node",
    get,
    path = "/api/v1/docker/images",
    responses(
        (status = 200, description = "List all docker images", body = inline(Vec<DockerImageInfo>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn list_all_images(
    auth: UserAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<DockerImageInfo>>, crate::error::DaemonError> {
    if let Err(e) = auth.require_permission("system:docker") {
        return Err(crate::error::DaemonError::BadRequest(e.to_string()));
    }
    match state.docker.list_all_images().await {
        Ok(v) => Ok(Json(v)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
pub struct PullImagePayload {
    pub image_name: String,
}

#[utoipa::path(
    tag = "Docker",
    summary = "Pull a Docker image from a remote registry",
    post,
    path = "/api/v1/docker/images/pull",
    request_body = PullImagePayload,
    responses(
        (status = 200, description = "Pull a docker image", body = inline(String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn pull_image(
    auth: UserAuth,
    State(state): State<AppState>,
    Json(payload): Json<PullImagePayload>,
) -> Result<Json<String>, crate::error::DaemonError> {
    if let Err(e) = auth.require_permission("system:docker") {
        return Err(crate::error::DaemonError::BadRequest(e.to_string()));
    }
    match state
        .docker
        .run_docker_command(&["pull", &payload.image_name])
        .await
    {
        Ok(v) => Ok(Json(v)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}

#[utoipa::path(
    tag = "Docker",
    summary = "Remove a specified Docker image from the node",
    delete,
    path = "/api/v1/docker/images/{id}",
    params(
        ("id" = String, Path, description = "Image ID")
    ),
    responses(
        (status = 200, description = "Remove a docker image", body = inline(String))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn remove_image(
    auth: UserAuth,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<String>, crate::error::DaemonError> {
    if let Err(e) = auth.require_permission("system:docker") {
        return Err(crate::error::DaemonError::BadRequest(e.to_string()));
    }
    match state.docker.run_docker_command(&["rmi", "-f", &id]).await {
        Ok(v) => Ok(Json(v)),
        Err(e) => Err(crate::error::DaemonError::BadRequest(format!("{:#}", e))),
    }
}
