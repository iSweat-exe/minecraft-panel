use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;
use jsonwebtoken::{decode, DecodingKey, Validation};
use protocol::{DaemonClaims, NODE_TOKEN_HEADER};

use crate::config::DaemonConfig;

/// Extractor for Node-to-Node requests authenticated via X-Node-Token
pub struct NodeAuth;

impl<S> FromRequestParts<S> for NodeAuth
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let node_token = {
            let config = parts
                .extensions
                .get::<DaemonConfig>()
                .ok_or((StatusCode::INTERNAL_SERVER_ERROR, "Config missing"))?;
            config.node_token.clone()
        };

        let token = parts
            .headers
            .get(NODE_TOKEN_HEADER)
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string());

        match token {
            Some(t) if t == node_token => Ok(NodeAuth),
            Some(_) => {
                tracing::warn!("NodeAuth rejected: invalid node token");
                Err((StatusCode::UNAUTHORIZED, "Invalid or missing node token"))
            }
            None => {
                tracing::warn!("NodeAuth rejected: no token provided");
                Err((StatusCode::UNAUTHORIZED, "Invalid or missing node token"))
            }
        }
    }
}

pub struct SessionAuth {
    pub claims: DaemonClaims,
    pub raw_token: String,
}

impl<S> FromRequestParts<S> for SessionAuth
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let jwt_secret = {
            let config = parts
                .extensions
                .get::<DaemonConfig>()
                .ok_or((StatusCode::INTERNAL_SERVER_ERROR, "Config missing"))?;
            config.jwt_secret.clone()
        };

        // 1. Try Authorization: Bearer <token>
        let mut raw_token = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok())
            .and_then(|h| h.strip_prefix("Bearer "))
            .map(|s| s.to_string());

        // 2. Fallback to Sec-WebSocket-Protocol (for WebSocket connections)
        if raw_token.is_none() {
            if let Some(protocols) = parts.headers.get("Sec-WebSocket-Protocol") {
                if let Ok(protocols_str) = protocols.to_str() {
                    let tokens: Vec<&str> = protocols_str.split(',').map(|s| s.trim()).collect();
                    if let Some(token) = tokens.last() {
                        raw_token = Some(token.to_string());
                    }
                }
            }
        }

        let token_str = raw_token.ok_or((StatusCode::UNAUTHORIZED, "Missing JWT session token"))?;

        let decoding_key = DecodingKey::from_secret(jwt_secret.as_bytes());
        let validation = Validation::default();

        match decode::<DaemonClaims>(&token_str, &decoding_key, &validation) {
            Ok(token_data) => Ok(SessionAuth {
                claims: token_data.claims,
                raw_token: token_str,
            }),
            Err(e) => {
                tracing::warn!("SessionAuth rejected: invalid/expired JWT: {}", e);
                Err((
                    StatusCode::UNAUTHORIZED,
                    "Invalid or expired JWT session token",
                ))
            }
        }
    }
}

/// Extractor to enforce PROTOCOL_VERSION match on incoming requests
/// Extractor for checking client protocol version header match against daemon protocol version
#[allow(dead_code)]
pub struct ProtocolVersionCheck;

impl<S> FromRequestParts<S> for ProtocolVersionCheck
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let version_header = parts
            .headers
            .get(protocol::auth::PROTOCOL_VERSION_HEADER)
            .and_then(|h| h.to_str().ok());

        if let Some(v_str) = version_header {
            match v_str.parse::<u32>() {
                Ok(ver) if ver == protocol::PROTOCOL_VERSION => Ok(ProtocolVersionCheck),
                _ => Err((StatusCode::UPGRADE_REQUIRED, "Protocol version mismatch")),
            }
        } else {
            Err((
                StatusCode::UPGRADE_REQUIRED,
                "Protocol version header missing",
            ))
        }
    }
}

/// Extractor for requests that require user authorization (Daemon-side permissions)
#[derive(Clone)]
pub struct UserAuth {
    pub username: String,
    pub role: String,
    pub permissions: Vec<String>,
}

impl axum::extract::FromRequestParts<crate::routes::AppState> for UserAuth {
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        state: &crate::routes::AppState,
    ) -> Result<Self, Self::Rejection> {
        let node_token = state.config.node_token.clone();

        let token = parts
            .headers
            .get(protocol::NODE_TOKEN_HEADER)
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string())
            .or_else(|| {
                parts
                    .headers
                    .get(axum::http::header::AUTHORIZATION)
                    .and_then(|h| h.to_str().ok())
                    .and_then(|s| {
                        s.strip_prefix("Bearer ")
                            .or_else(|| s.strip_prefix("bearer "))
                    })
                    .map(|s| s.to_string())
            });

        let mut using_jwt = false;
        let mut jwt_username = None;

        match token {
            Some(ref t) if t == &node_token => {}
            Some(ref t) => {
                let token_data = jsonwebtoken::decode::<protocol::auth::DaemonClaims>(
                    t,
                    &jsonwebtoken::DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
                    &jsonwebtoken::Validation::default(),
                );
                match token_data {
                    Ok(data) => {
                        using_jwt = true;
                        jwt_username = Some(data.claims.sub);
                    }
                    Err(e) => {
                        tracing::warn!("UserAuth: Invalid token: {}", e);
                        return Err((
                            StatusCode::UNAUTHORIZED,
                            "Invalid or expired authorization token",
                        ));
                    }
                }
            }
            _ => return Err((StatusCode::UNAUTHORIZED, "Invalid or missing node token")),
        }

        let panel_user = if using_jwt {
            jwt_username
        } else {
            parts
                .headers
                .get(protocol::PANEL_USER_HEADER)
                .and_then(|h| h.to_str().ok().map(|s| s.to_string()))
        };

        if let Some(username) = panel_user {
            match Self::fetch_from_db(&state.db, &username).await? {
                Some(user_auth) => return Ok(user_auth),
                None => {
                    tracing::warn!("UserAuth: User '{}' not found in database", username);
                    return Err((StatusCode::FORBIDDEN, "User not found"));
                }
            }
        }

        // Safety: When no X-Panel-User header is supplied by an authenticated Node token,
        // execution defaults to the internal system user context with full permissions ("*").
        Ok(UserAuth {
            username: "system".to_string(),
            role: "system".to_string(),
            permissions: vec!["*".to_string()],
        })
    }
}

use crate::error::DaemonError;

impl UserAuth {
    /// Fetches user authorization permissions from the SQLite database
    pub async fn fetch_from_db(
        db: &sqlx::SqlitePool,
        username: &str,
    ) -> Result<Option<Self>, (StatusCode, &'static str)> {
        #[derive(sqlx::FromRow)]
        struct UserRow {
            username: String,
            role: String,
            permissions: String,
        }

        match sqlx::query_as::<_, UserRow>(
            "SELECT username, role, permissions FROM users WHERE username = ?",
        )
        .bind(username)
        .fetch_optional(db)
        .await
        {
            Ok(Some(row)) => {
                let perms: Vec<String> = serde_json::from_str(&row.permissions).unwrap_or_default();
                Ok(Some(UserAuth {
                    username: row.username,
                    role: row.role,
                    permissions: perms,
                }))
            }
            Ok(None) => Ok(None),
            Err(e) => {
                tracing::warn!("UserAuth: Failed to load user: {}", e);
                Err((StatusCode::INTERNAL_SERVER_ERROR, "Database error"))
            }
        }
    }

    pub fn require_permission(&self, permission: &str) -> Result<(), DaemonError> {
        if self.role == "admin" || self.permissions.contains(&"*".to_string()) {
            return Ok(());
        }

        if self.permissions.contains(&permission.to_string()) {
            return Ok(());
        }

        tracing::warn!(
            user = %self.username,
            role = %self.role,
            required = %permission,
            "Permission denied"
        );
        Err(DaemonError::Forbidden(
            "You do not have permission to perform this action".to_string(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_admin_has_all_permissions() {
        let auth = UserAuth {
            username: "admin_user".to_string(),
            role: "admin".to_string(),
            permissions: vec![],
        };
        assert!(auth.require_permission("servers.delete").is_ok());
    }

    #[test]
    fn test_wildcard_permission_allows_action() {
        let auth = UserAuth {
            username: "power_user".to_string(),
            role: "user".to_string(),
            permissions: vec!["*".to_string()],
        };
        assert!(auth.require_permission("any.action").is_ok());
    }

    #[test]
    fn test_exact_permission_match() {
        let auth = UserAuth {
            username: "sub_user".to_string(),
            role: "user".to_string(),
            permissions: vec!["server:files".to_string()],
        };
        assert!(auth.require_permission("server:files").is_ok());
        assert!(auth.require_permission("server:power").is_err());
    }
}
