use axum::extract::State;
use axum::Json;
use protocol::ApiResponse;
use serde::Serialize;

use crate::auth::UserAuth;
use crate::error::DaemonError;
use crate::routes::AppState;

#[derive(Serialize)]
pub struct AllocationResponse {
    pub server_id: String,
    pub host_ip: String,
    pub host_port: i32,
}

pub async fn list_allocations(
    auth: UserAuth,
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<AllocationResponse>>>, DaemonError> {
    auth.require_permission("servers.read")?;

    #[derive(sqlx::FromRow)]
    struct DbAllocation {
        server_id: String,
        host_ip: String,
        host_port: i32,
    }

    let rows = sqlx::query_as::<_, DbAllocation>("SELECT server_id, host_ip, host_port FROM server_allocations")
        .fetch_all(&state.db)
        .await?;

    let mut allocations = Vec::new();
    for row in rows {
        allocations.push(AllocationResponse {
            server_id: row.server_id,
            host_ip: row.host_ip,
            host_port: row.host_port,
        });
    }

    Ok(Json(ApiResponse::ok(allocations)))
}
