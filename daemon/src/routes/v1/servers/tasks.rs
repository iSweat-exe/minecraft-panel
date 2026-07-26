use axum::{
    extract::{Path, State},
    response::sse::{Event, Sse},
    response::IntoResponse,
};
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;
use uuid::Uuid;

use crate::routes::AppState;
use crate::services::auth::NodeAuth;

pub async fn stream_task(
    _auth: NodeAuth,
    State(state): State<AppState>,
    Path((server_id, task_id_str)): Path<(String, String)>,
) -> impl IntoResponse {
    let task_id = match Uuid::parse_str(&task_id_str) {
        Ok(id) => id,
        Err(_) => return (axum::http::StatusCode::BAD_REQUEST, "Invalid task ID").into_response(),
    };

    let task = match state.task_mgr.get_task(&task_id).await {
        Some(t) => t,
        None => return (axum::http::StatusCode::NOT_FOUND, "Task not found").into_response(),
    };

    let t_read = task.read().await;
    
    if t_read.server_id != server_id {
        return (axum::http::StatusCode::NOT_FOUND, "Task not found").into_response();
    }

    let is_done = matches!(
        t_read.status,
        crate::services::tasks::TaskStatus::Completed | crate::services::tasks::TaskStatus::Failed(_)
    );
    let final_status = t_read.status.clone();
    
    let rx = t_read.tx.subscribe();
    drop(t_read);

    if is_done {
        let stream = tokio_stream::once(Ok::<_, Infallible>(
            Event::default()
                .data(serde_json::to_string(&crate::services::tasks::TaskEvent::Status(final_status)).unwrap_or_default())
        ));
        return Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default()).into_response();
    }

    let stream = BroadcastStream::new(rx).map(|res| {
        match res {
            Ok(event) => {
                let json = serde_json::to_string(&event).unwrap_or_default();
                Ok::<_, Infallible>(Event::default().data(json))
            }
            Err(_) => {
                Ok::<_, Infallible>(Event::default().event("error").data("lagged"))
            }
        }
    });

    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default()).into_response()
}
