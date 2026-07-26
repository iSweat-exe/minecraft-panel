use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::routes::AppState;
use crate::services::auth::UserAuth;

#[derive(Serialize, Deserialize, Clone, utoipa::ToSchema)]
pub struct UserResponse {
    pub uuid: Option<String>,
    pub username: String,
    pub role: String,
    pub permissions: Vec<String>,
    pub created_at: Option<i64>,
    #[serde(skip_serializing)]
    #[allow(dead_code)]
    pub password_hash: Option<String>,
    pub avatar_base64: Option<String>,
    pub display_name: Option<String>,
    pub is_superadmin: bool,
}

#[derive(Deserialize, Clone, utoipa::ToSchema)]
pub struct CreateUserRequest {
    pub uuid: Option<String>,
    pub username: String,
    pub role: String,
    pub permissions: Vec<String>,
    pub password_hash: Option<String>,
    pub avatar_base64: Option<String>,
    pub display_name: Option<String>,
}

#[derive(Deserialize, Clone, utoipa::ToSchema)]
pub struct PatchUserRequest {
    pub role: Option<String>,
    pub permissions: Option<Vec<String>>,
    pub password_hash: Option<String>,
    pub avatar_base64: Option<String>,
    pub display_name: Option<String>,
}


pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/users", get(list_users).post(save_user))
        .route(
            "/api/v1/users/{username}",
            axum::routing::patch(patch_user).delete(delete_user),
        )
}

#[derive(sqlx::FromRow)]
struct DbUser {
    uuid: String,
    username: String,
    role: String,
    permissions: String,
    created_at: i64,
    password_hash: Option<String>,
    avatar_base64: Option<String>,
    display_name: Option<String>,
    is_superadmin: i64,
}

#[utoipa::path(
    tag = "Users",
    summary = "Retrieve a list of all registered users",
    get,
    path = "/api/v1/users",
    responses(
        (status = 200, description = "List all users", body = inline(Vec<UserResponse>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn list_users(
    auth: UserAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<UserResponse>>, crate::error::DaemonError> {
    auth.require_permission("users.read")?;

    let rows = sqlx::query_as::<_, DbUser>("SELECT * FROM users")
        .fetch_all(&state.db)
        .await?;

    let mut users = Vec::new();
    for row in rows {
        let permissions: Vec<String> =
            serde_json::from_str(&row.permissions).unwrap_or_else(|_| vec![]);
        users.push(UserResponse {
            uuid: Some(row.uuid),
            username: row.username,
            role: row.role,
            permissions,
            created_at: Some(row.created_at),
            password_hash: row.password_hash,
            avatar_base64: row.avatar_base64,
            display_name: row.display_name,
            is_superadmin: row.is_superadmin == 1,
        });
    }

    Ok(Json(users))
}

#[utoipa::path(
    tag = "Users",
    summary = "Create a new user or update an existing user's details",
    post,
    path = "/api/v1/users",
    request_body = CreateUserRequest,
    responses(
        (status = 200, description = "User created", body = inline(Vec<UserResponse>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn save_user(
    auth: UserAuth,
    State(state): State<AppState>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<Vec<UserResponse>>, crate::error::DaemonError> {
    auth.require_permission("users.manage")?;

    if payload.username.trim().is_empty() || payload.username.len() < 3 {
        return Err(crate::error::DaemonError::BadRequest(
            "Le nom d'utilisateur doit faire au moins 3 caractères".into(),
        ));
    }

    let now = chrono::Utc::now().timestamp();
    let uuid = payload.uuid.unwrap_or_else(|| Uuid::new_v4().to_string());
    let perms_json =
        serde_json::to_string(&payload.permissions).unwrap_or_else(|_| "[]".to_string());

    #[derive(sqlx::FromRow)]
    struct ExistingUserRow {
        uuid: String,
        is_superadmin: i64,
    }

    let existing = sqlx::query_as::<_, ExistingUserRow>(
        "SELECT uuid, is_superadmin FROM users WHERE username = ?",
    )
    .bind(&payload.username)
    .fetch_optional(&state.db)
    .await?;

    if let Some(row) = existing {
        if row.is_superadmin == 1 && payload.role != "admin" {
            return Err(crate::error::DaemonError::BadRequest(
                "Impossible de retirer le rôle admin d'un superadmin".into(),
            ));
        }

        sqlx::query(
            "UPDATE users SET role = ?, permissions = ?, password_hash = COALESCE(?, password_hash), avatar_base64 = ?, display_name = ? WHERE uuid = ?"
        )
        .bind(&payload.role)
        .bind(&perms_json)
        .bind(&payload.password_hash)
        .bind(&payload.avatar_base64)
        .bind(&payload.display_name)
        .bind(&row.uuid)
        .execute(&state.db)
        .await?;
    } else {
        sqlx::query(
            "INSERT INTO users (uuid, username, role, permissions, created_at, password_hash, avatar_base64, display_name, is_superadmin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)"
        )
        .bind(&uuid)
        .bind(&payload.username)
        .bind(&payload.role)
        .bind(&perms_json)
        .bind(now)
        .bind(&payload.password_hash)
        .bind(&payload.avatar_base64)
        .bind(&payload.display_name)
        .execute(&state.db)
        .await?;
    }

    list_users(auth.clone(), State(state)).await
}

#[utoipa::path(
    tag = "Users",
    summary = "Permanently delete a specified user",
    delete,
    path = "/api/v1/users/{username}",
    params(
        ("username" = String, Path, description = "Username of the user to delete")
    ),
    responses(
        (status = 200, description = "User deleted", body = inline(Vec<UserResponse>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn delete_user(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Json<Vec<UserResponse>>, crate::error::DaemonError> {
    auth.require_permission("users.manage")?;

    let is_superadmin =
        sqlx::query_scalar::<_, i64>("SELECT is_superadmin FROM users WHERE username = ?")
            .bind(&username)
            .fetch_optional(&state.db)
            .await?
            .unwrap_or(0);

    if is_superadmin == 1 {
        return Err(crate::error::DaemonError::BadRequest(
            "Un compte superadmin ne peut pas être supprimé".into(),
        ));
    }

    sqlx::query("DELETE FROM users WHERE username = ?")
        .bind(&username)
        .execute(&state.db)
        .await?;

    list_users(auth.clone(), State(state)).await
}

#[utoipa::path(
    tag = "Users",
    summary = "Partially update properties of a specific user",
    patch,
    path = "/api/v1/users/{username}",
    request_body = PatchUserRequest,
    params(
        ("username" = String, Path, description = "Username of the user to update")
    ),
    responses(
        (status = 200, description = "User updated", body = inline(Vec<UserResponse>))
    ),
    security(
        ("bearer_auth" = [])
    )
)]
async fn patch_user(
    auth: UserAuth,
    State(state): State<AppState>,
    Path(username): Path<String>,
    Json(payload): Json<PatchUserRequest>,
) -> Result<Json<Vec<UserResponse>>, crate::error::DaemonError> {
    auth.require_permission("users.manage")?;

    #[derive(sqlx::FromRow)]
    struct ExistingUserRow {
        uuid: String,
        is_superadmin: i64,
        role: String,
        permissions: String,
        password_hash: Option<String>,
        avatar_base64: Option<String>,
        display_name: Option<String>,
    }

    let existing = sqlx::query_as::<_, ExistingUserRow>("SELECT uuid, is_superadmin, role, permissions, password_hash, avatar_base64, display_name FROM users WHERE username = ?")
        .bind(&username)
        .fetch_optional(&state.db)
        .await?;

    let row = match existing {
        Some(r) => r,
        None => return Err(crate::error::DaemonError::NotFound("User not found".into())),
    };

    let new_role = payload.role.unwrap_or(row.role);
    if row.is_superadmin == 1 && new_role != "admin" {
        return Err(crate::error::DaemonError::BadRequest(
            "Impossible de retirer le rôle admin d'un superadmin".into(),
        ));
    }

    let new_perms_json = match payload.permissions {
        Some(p) => serde_json::to_string(&p).unwrap_or_else(|_| "[]".to_string()),
        None => row.permissions,
    };

    let new_password_hash = payload.password_hash.or(row.password_hash);
    let new_avatar_base64 = payload.avatar_base64.or(row.avatar_base64);
    let new_display_name = payload.display_name.or(row.display_name);

    sqlx::query(
        "UPDATE users SET role = ?, permissions = ?, password_hash = ?, avatar_base64 = ?, display_name = ? WHERE uuid = ?"
    )
    .bind(&new_role)
    .bind(&new_perms_json)
    .bind(&new_password_hash)
    .bind(&new_avatar_base64)
    .bind(&new_display_name)
    .bind(&row.uuid)
    .execute(&state.db)
    .await?;

    list_users(auth.clone(), State(state)).await
}
