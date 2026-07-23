use crate::error::AppError;
use jsonwebtoken::{encode, EncodingKey, Header};
use protocol::{
    ApiResponse, ContainerSpec, DaemonClaims, DaemonInfoResponse, PowerActionRequest,
    PowerActionResponse, ServerPowerAction, ServerStatusResponse, NODE_TOKEN_HEADER,
    PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER,
};
use reqwest::Client;
use std::time::Duration;

#[derive(Clone)]
pub struct DaemonClient {
    node_url: String,
    node_token: String,
    client: Client,
}

impl DaemonClient {
    pub fn new(node_url: impl Into<String>, node_token: impl Into<String>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        let mut url = node_url.into();
        if url.ends_with('/') {
            url.pop();
        }

        Self {
            node_url: url,
            node_token: node_token.into(),
            client,
        }
    }

    fn build_url(&self, path: &str) -> String {
        format!("{}{}", self.node_url, path)
    }

    /// Fetch daemon info (version, uptime, total servers, running servers)
    pub async fn get_info(&self) -> Result<DaemonInfoResponse, AppError> {
        let url = self.build_url("/api/v1/info");
        let res = self
            .client
            .get(&url)
            .header(NODE_TOKEN_HEADER, &self.node_token)
            .header(PROTOCOL_VERSION_HEADER, PROTOCOL_VERSION.to_string())
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(AppError::Message(format!(
                "Daemon returned HTTP {}",
                res.status()
            )));
        }

        let body: ApiResponse<DaemonInfoResponse> = res.json().await?;
        if body.success {
            body.data
                .ok_or_else(|| AppError::Message("Missing response data".into()))
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    /// List all managed containers on the node
    pub async fn list_servers(&self) -> Result<Vec<ServerStatusResponse>, AppError> {
        let url = self.build_url("/api/v1/servers");
        let res = self
            .client
            .get(&url)
            .header(NODE_TOKEN_HEADER, &self.node_token)
            .header(PROTOCOL_VERSION_HEADER, PROTOCOL_VERSION.to_string())
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(AppError::Message(format!(
                "Daemon returned HTTP {}",
                res.status()
            )));
        }

        let body: ApiResponse<Vec<ServerStatusResponse>> = res.json().await?;
        if body.success {
            Ok(body.data.unwrap_or_default())
        } else {

            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    /// Create a new server container on the node
    pub async fn create_server(&self, spec: ContainerSpec) -> Result<String, AppError> {
        let url = self.build_url("/api/v1/servers");
        let payload = protocol::CreateServerRequest { spec };

        let res = self
            .client
            .post(&url)
            .header(NODE_TOKEN_HEADER, &self.node_token)
            .header(PROTOCOL_VERSION_HEADER, PROTOCOL_VERSION.to_string())
            .json(&payload)
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(AppError::Message(format!(
                "Daemon returned HTTP {}",
                res.status()
            )));
        }

        let body: ApiResponse<String> = res.json().await?;
        if body.success {
            body.data
                .ok_or_else(|| AppError::Message("Missing container ID in response".into()))
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Failed to create server".into()),
            ))
        }
    }

    /// Trigger power action (start, stop, restart, kill) on a server container
    pub async fn power_action(
        &self,
        server_id: &str,
        action: ServerPowerAction,
    ) -> Result<PowerActionResponse, AppError> {
        let url = self.build_url(&format!("/api/v1/servers/{}/power", server_id));
        let payload = PowerActionRequest { action };

        let res = self
            .client
            .post(&url)
            .header(NODE_TOKEN_HEADER, &self.node_token)
            .header(PROTOCOL_VERSION_HEADER, PROTOCOL_VERSION.to_string())
            .json(&payload)
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(AppError::Message(format!(
                "Daemon returned HTTP {}",
                res.status()
            )));
        }

        let body: ApiResponse<PowerActionResponse> = res.json().await?;
        if body.success {
            body.data
                .ok_or_else(|| AppError::Message("Missing power action response".into()))
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Power action failed".into()),
            ))
        }
    }

    /// Delete a server container on the node
    pub async fn delete_server(&self, server_id: &str) -> Result<String, AppError> {
        let url = self.build_url(&format!("/api/v1/servers/{}", server_id));

        let res = self
            .client
            .delete(&url)
            .header(NODE_TOKEN_HEADER, &self.node_token)
            .header(PROTOCOL_VERSION_HEADER, PROTOCOL_VERSION.to_string())
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(AppError::Message(format!(
                "Daemon returned HTTP {}",
                res.status()
            )));
        }

        let body: ApiResponse<String> = res.json().await?;
        if body.success {
            body.data
                .ok_or_else(|| AppError::Message("Missing deletion response".into()))
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Deletion failed".into()),
            ))
        }
    }

    /// Mint an ephemeral JWT session token for direct WebSocket console streaming
    pub fn mint_session_jwt(
        sub: &str,
        server_id: &str,
        permissions: Vec<String>,
        jwt_secret: &str,
        duration_secs: u64,
    ) -> Result<String, AppError> {
        let claims = DaemonClaims::new(sub, server_id, permissions, duration_secs);
        let encoding_key = EncodingKey::from_secret(jwt_secret.as_bytes());

        encode(&Header::default(), &claims, &encoding_key)
            .map_err(|e| AppError::Message(format!("JWT encoding error: {}", e)))
    }
}
