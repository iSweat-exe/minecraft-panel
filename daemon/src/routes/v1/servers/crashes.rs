use axum::extract::{Path, State};
use axum::Json;
use protocol::{ServerCrashesResponse};

use crate::routes::AppState;
use crate::services::auth::NodeAuth;
use bollard::exec::{CreateExecOptions, StartExecResults};
use futures_util::StreamExt;

#[utoipa::path(
    tag = "Servers",
    summary = "Retrieve a list of crash reports for a specific server",
    get,
    path = "/api/v1/servers/{server_id}/crashes",
    params(
        ("server_id" = String, Path, description = "Server ID")
    ),
    responses(
        (status = 200, description = "Get server crashes", body = inline(protocol::ServerCrashesResponse))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn server_crashes(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(server_id): Path<String>,
) -> Result<Json<ServerCrashesResponse>, crate::error::DaemonError> {
    let container_name = crate::services::docker::DockerManager::container_name(&server_id);
    let docker = state.docker.docker_client();

    let exec = match docker
        .create_exec(
            &container_name,
            CreateExecOptions {
                attach_stdout: Some(true),
                attach_stderr: Some(true),
                cmd: Some(vec![
                    "sh",
                    "-c",
                    "ls -1t crash-reports/*.txt 2>/dev/null | head -n 5",
                ]),
                ..Default::default()
            },
        )
        .await
    {
        Ok(e) => e,
        Err(_) => return Err(crate::error::DaemonError::BadRequest("Failed to create exec in container".to_string())),
    };

    let mut output = Vec::new();
    if let Ok(StartExecResults::Attached {
        output: mut stream, ..
    }) = docker.start_exec(&exec.id, None).await
    {
        while let Some(Ok(msg)) = stream.next().await {
            output.extend_from_slice(msg.into_bytes().as_ref());
        }
    }

    let output_str = String::from_utf8_lossy(&output);
    let crashes = output_str
        .lines()
        .filter(|l| !l.is_empty())
        .map(|s| s.to_string())
        .collect();

    Ok(Json(ServerCrashesResponse {
        crash_reports: crashes,
    }))
}
