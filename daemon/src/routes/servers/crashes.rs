use axum::extract::{Path, State};
use axum::Json;
use protocol::{ApiResponse, ServerCrashesResponse};

use crate::auth::NodeAuth;
use crate::routes::AppState;
use bollard::exec::{CreateExecOptions, StartExecResults};
use futures_util::StreamExt;

pub async fn server_crashes(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<ServerCrashesResponse>> {
    let container_name = format!("mc-server-{}", id);
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
        Err(_) => return Json(ApiResponse::err("Failed to create exec in container")),
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

    Json(ApiResponse::ok(ServerCrashesResponse {
        crash_reports: crashes,
    }))
}
