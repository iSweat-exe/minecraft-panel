use axum::extract::{FromRequestParts, Query};
use axum::http::request::Parts;
use axum::http::StatusCode;
use jsonwebtoken::{decode, DecodingKey, Validation};
use protocol::{DaemonClaims, NODE_TOKEN_HEADER};
use serde::Deserialize;

use crate::config::DaemonConfig;

/// Extractor for Node-to-Node requests authenticated via X-Node-Token
pub struct NodeAuth;

impl<S> FromRequestParts<S> for NodeAuth
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let config = parts
            .extensions
            .get::<DaemonConfig>()
            .ok_or((StatusCode::INTERNAL_SERVER_ERROR, "Config missing"))?;

        let token = parts
            .headers
            .get(NODE_TOKEN_HEADER)
            .and_then(|h| h.to_str().ok());

        match token {
            Some(t) if t == config.node_token => Ok(NodeAuth),
            _ => Err((StatusCode::UNAUTHORIZED, "Invalid or missing node token")),
        }
    }
}

#[derive(Deserialize)]
pub struct WsAuthQuery {
    pub token: Option<String>,
}

/// Extractor for Ephemeral Session JWT tokens (used by WebSocket & direct browser connections)
pub struct SessionAuth(pub DaemonClaims);

impl<S> FromRequestParts<S> for SessionAuth
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
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

        // 2. Fallback to query parameter ?token=<token>
        if raw_token.is_none() {
            if let Ok(Query(WsAuthQuery { token: Some(t) })) =
                Query::<WsAuthQuery>::from_request_parts(parts, state).await
            {
                raw_token = Some(t);
            }
        }

        let token_str = raw_token.ok_or((StatusCode::UNAUTHORIZED, "Missing JWT session token"))?;

        let decoding_key = DecodingKey::from_secret(jwt_secret.as_bytes());
        let validation = Validation::default();

        match decode::<DaemonClaims>(&token_str, &decoding_key, &validation) {
            Ok(token_data) => Ok(SessionAuth(token_data.claims)),
            Err(_) => Err((StatusCode::UNAUTHORIZED, "Invalid or expired JWT session token")),
        }
    }
}

/// Extractor to enforce PROTOCOL_VERSION match on incoming requests
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
            // Optional: require header or default to matching current version
            Ok(ProtocolVersionCheck)
        }
    }
}
