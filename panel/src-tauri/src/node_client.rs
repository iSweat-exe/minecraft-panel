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
            .timeout(Duration::from_secs(300))
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
                body.error
                    .unwrap_or_else(|| "Failed to create server".into()),
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

    /// Inspect a server container
    pub async fn inspect_container(&self, server_id: &str) -> Result<serde_json::Value, AppError> {
        let url = self.build_url(&format!("/api/v1/servers/{}/inspect", server_id));
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

        let body: ApiResponse<serde_json::Value> = res.json().await?;
        if body.success {
            body.data
                .ok_or_else(|| AppError::Message("Missing response data".into()))
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Inspect failed".into()),
            ))
        }
    }

    /// Send a console command to a server container
    pub async fn send_command(&self, server_id: &str, command: &str) -> Result<String, AppError> {
        let url = self.build_url(&format!("/api/v1/servers/{}/command", server_id));
        let payload = serde_json::json!({ "command": command });

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
                .ok_or_else(|| AppError::Message("Missing response data".into()))
        } else {
            Err(AppError::Message(
                body.error
                    .unwrap_or_else(|| "Command execution failed".into()),
            ))
        }
    }

    /// Send multiple RCON commands to a server and get their responses
    pub async fn rcon_execute_multi(
        &self,
        server_id: &str,
        commands: Vec<String>,
    ) -> Result<Vec<String>, AppError> {
        let url = self.build_url(&format!("/api/v1/servers/{}/rcon_multi", server_id));
        let payload = serde_json::json!({ "commands": commands });

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

        let body: ApiResponse<Vec<String>> = res.json().await?;
        if body.success {
            body.data
                .ok_or_else(|| AppError::Message("Missing response data".into()))
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "RCON execution failed".into()),
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

    pub async fn get_metrics(&self) -> Result<protocol::SystemMetricsResponse, AppError> {
        let url = self.build_url("/api/v1/metrics");
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

        let body: ApiResponse<protocol::SystemMetricsResponse> = res.json().await?;
        if body.success {
            body.data
                .ok_or_else(|| AppError::Message("Missing metrics data".into()))
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    pub async fn list_dir(&self, path: &str) -> Result<Vec<protocol::FileEntry>, AppError> {
        let url = self.build_url(&format!(
            "/api/v1/files/list?path={}",
            urlencoding::encode(path)
        ));
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

        let body: ApiResponse<Vec<protocol::FileEntry>> = res.json().await?;
        if body.success {
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    pub async fn read_file(&self, path: &str) -> Result<String, AppError> {
        use base64::Engine;
        let url = self.build_url(&format!(
            "/api/v1/files/read?path={}",
            urlencoding::encode(path)
        ));
        let res = self
            .client
            .get(&url)
            .header(NODE_TOKEN_HEADER, &self.node_token)
            .header(PROTOCOL_VERSION_HEADER, PROTOCOL_VERSION.to_string())
            .send()
            .await?;

        if !res.status().is_success() {
            let status = res.status();
            if let Ok(body) = res.json::<ApiResponse<()>>().await {
                return Err(AppError::Message(
                    body.error.unwrap_or_else(|| format!("HTTP {}", status)),
                ));
            }
            return Err(AppError::Message(format!(
                "Daemon returned HTTP {}",
                status
            )));
        }

        let bytes = res
            .bytes()
            .await
            .map_err(|e| AppError::Message(format!("Failed to read response bytes: {}", e)))?;
        let base64_str = base64::engine::general_purpose::STANDARD.encode(&bytes);
        Ok(base64_str)
    }

    pub async fn write_file(&self, path: &str, content: String) -> Result<(), AppError> {
        let url = self.build_url(&format!(
            "/api/v1/files/write?path={}",
            urlencoding::encode(path)
        ));
        let payload = protocol::FileWriteRequest { content };

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
            Ok(())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    pub async fn upload_file(&self, path: &str, content: Vec<u8>) -> Result<(), AppError> {
        let url = self.build_url(&format!(
            "/api/v1/files/upload?path={}",
            urlencoding::encode(path)
        ));
        let res = self
            .client
            .post(&url)
            .header(NODE_TOKEN_HEADER, &self.node_token)
            .header(PROTOCOL_VERSION_HEADER, PROTOCOL_VERSION.to_string())
            .body(content)
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
            Ok(())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    pub async fn file_action(
        &self,
        path: &str,
        action: protocol::FileAction,
    ) -> Result<(), AppError> {
        let url = self.build_url(&format!(
            "/api/v1/files/action?path={}",
            urlencoding::encode(path)
        ));
        let payload = protocol::FileActionRequest { action };

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
            Ok(())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    pub async fn get_system_host(&self) -> Result<protocol::SystemHostResponse, AppError> {
        let url = self.build_url("/api/v1/system/host");
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

        let body: ApiResponse<protocol::SystemHostResponse> = res.json().await?;
        if body.success {
            body.data
                .ok_or_else(|| AppError::Message("Missing response data".into()))
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    pub async fn get_system_health(&self) -> Result<protocol::SystemHealthResponse, AppError> {
        let url = self.build_url("/api/v1/system/health");
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

        let body: ApiResponse<protocol::SystemHealthResponse> = res.json().await?;
        if body.success {
            body.data
                .ok_or_else(|| AppError::Message("Missing response data".into()))
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    pub async fn get_system_logs(
        &self,
        lines: Option<usize>,
    ) -> Result<protocol::ServerLogsResponse, AppError> {
        let lines_query = lines.unwrap_or(100);
        let url = self.build_url(&format!("/api/v1/system/logs?lines={}", lines_query));
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

        let body: ApiResponse<protocol::ServerLogsResponse> = res.json().await?;
        if body.success {
            body.data
                .ok_or_else(|| AppError::Message("Missing response data".into()))
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    pub async fn get_server_ping(
        &self,
        server_id: &str,
    ) -> Result<protocol::MinecraftPingResponse, AppError> {
        let url = self.build_url(&format!("/api/v1/servers/{}/ping", server_id));
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

        let body: ApiResponse<protocol::MinecraftPingResponse> = res.json().await?;
        if body.success {
            body.data
                .ok_or_else(|| AppError::Message("Missing response data".into()))
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    pub async fn get_server_crashes(
        &self,
        server_id: &str,
    ) -> Result<protocol::ServerCrashesResponse, AppError> {
        let url = self.build_url(&format!("/api/v1/servers/{}/crashes", server_id));
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

        let body: ApiResponse<protocol::ServerCrashesResponse> = res.json().await?;
        if body.success {
            body.data
                .ok_or_else(|| AppError::Message("Missing response data".into()))
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    pub async fn get_server_logs(
        &self,
        server_id: &str,
        lines: Option<usize>,
    ) -> Result<protocol::ServerLogsResponse, AppError> {
        let lines_query = lines.unwrap_or(100);
        let url = self.build_url(&format!(
            "/api/v1/servers/{}/logs?lines={}",
            server_id, lines_query
        ));
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

        let body: ApiResponse<protocol::ServerLogsResponse> = res.json().await?;
        if body.success {
            body.data
                .ok_or_else(|| AppError::Message("Missing response data".into()))
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    pub async fn docker_list_containers(
        &self,
    ) -> Result<Vec<protocol::DockerContainerInfo>, AppError> {
        let url = self.build_url("/api/v1/system/docker/containers");
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
        let body: ApiResponse<Vec<protocol::DockerContainerInfo>> = res.json().await?;
        if body.success {
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown error".into()),
            ))
        }
    }

    pub async fn docker_list_images(&self) -> Result<Vec<protocol::DockerImageInfo>, AppError> {
        let url = self.build_url("/api/v1/system/docker/images");
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
        let body: ApiResponse<Vec<protocol::DockerImageInfo>> = res.json().await?;
        if body.success {
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown error".into()),
            ))
        }
    }

    pub async fn docker_container_action(
        &self,
        id: &str,
        action: &str,
    ) -> Result<String, AppError> {
        let url = self.build_url(&format!("/api/v1/system/docker/containers/{}/action", id));
        let payload = serde_json::json!({ "action": action });
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
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown error".into()),
            ))
        }
    }

    pub async fn docker_container_logs(&self, id: &str) -> Result<String, AppError> {
        let url = self.build_url(&format!("/api/v1/system/docker/containers/{}/logs", id));
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
        let body: ApiResponse<String> = res.json().await?;
        if body.success {
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown error".into()),
            ))
        }
    }

    pub async fn docker_container_inspect(&self, id: &str) -> Result<String, AppError> {
        let url = self.build_url(&format!("/api/v1/system/docker/containers/{}/inspect", id));
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
        let body: ApiResponse<String> = res.json().await?;
        if body.success {
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown error".into()),
            ))
        }
    }

    pub async fn docker_run_container(
        &self,
        req: protocol::DockerRunRequest,
    ) -> Result<String, AppError> {
        let url = self.build_url("/api/v1/system/docker/containers");
        let res = self
            .client
            .post(&url)
            .header(NODE_TOKEN_HEADER, &self.node_token)
            .header(PROTOCOL_VERSION_HEADER, PROTOCOL_VERSION.to_string())
            .json(&req)
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
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown error".into()),
            ))
        }
    }

    pub async fn docker_update_container(
        &self,
        id: &str,
        req: protocol::DockerUpdateRequest,
    ) -> Result<String, AppError> {
        let url = self.build_url(&format!("/api/v1/system/docker/containers/{}", id));
        let res = self
            .client
            .put(&url)
            .header(NODE_TOKEN_HEADER, &self.node_token)
            .header(PROTOCOL_VERSION_HEADER, PROTOCOL_VERSION.to_string())
            .json(&req)
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
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown error".into()),
            ))
        }
    }

    pub async fn docker_recreate_container(
        &self,
        id: &str,
        req: protocol::DockerRunRequest,
    ) -> Result<String, AppError> {
        let url = self.build_url(&format!("/api/v1/system/docker/containers/{}/recreate", id));
        let res = self
            .client
            .post(&url)
            .header(NODE_TOKEN_HEADER, &self.node_token)
            .header(PROTOCOL_VERSION_HEADER, PROTOCOL_VERSION.to_string())
            .json(&req)
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
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown error".into()),
            ))
        }
    }

    pub async fn docker_pull_image(&self, image_name: &str) -> Result<String, AppError> {
        let url = self.build_url("/api/v1/system/docker/images/pull");
        let payload = serde_json::json!({ "image_name": image_name });
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
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown error".into()),
            ))
        }
    }

    pub async fn docker_remove_image(&self, id: &str) -> Result<String, AppError> {
        let url = self.build_url(&format!("/api/v1/system/docker/images/{}", id));
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
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown error".into()),
            ))
        }
    }

    pub async fn docker_system_prune(&self) -> Result<String, AppError> {
        let url = self.build_url("/api/v1/system/docker/prune");
        let res = self
            .client
            .post(&url)
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
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown error".into()),
            ))
        }
    }

    pub async fn api_request(
        &self,
        method: &str,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> Result<serde_json::Value, AppError> {
        let url = self.build_url(path);
        let mut req = match method.to_uppercase().as_str() {
            "GET" => self.client.get(&url),
            "POST" => self.client.post(&url),
            "PUT" => self.client.put(&url),
            "DELETE" => self.client.delete(&url),
            _ => return Err(AppError::Message("Invalid HTTP method".into())),
        };

        req = req
            .header(NODE_TOKEN_HEADER, &self.node_token)
            .header(PROTOCOL_VERSION_HEADER, PROTOCOL_VERSION.to_string());

        if let Some(b) = body {
            req = req.json(&b);
        }

        let res = req
            .send()
            .await
            .map_err(|e| AppError::Message(format!("Network error: {}", e)))?;
        let status = res.status();
        let body_text = res
            .text()
            .await
            .map_err(|e| AppError::Message(e.to_string()))?;

        let json: serde_json::Value = serde_json::from_str(&body_text).unwrap_or_else(|_| {
            serde_json::json!({
                "success": false,
                "error": format!("Invalid JSON response. Status: {}", status)
            })
        });

        if !status.is_success() {
            return Err(AppError::Message(
                json.get("error")
                    .and_then(|e| e.as_str())
                    .unwrap_or(&format!("Daemon HTTP {}", status))
                    .to_string(),
            ));
        }

        Ok(json)
    }

    pub async fn get_users(&self) -> Result<Vec<crate::models::PanelUser>, AppError> {
        let url = self.build_url("/api/users");
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

        let body: ApiResponse<Vec<crate::models::PanelUser>> = res.json().await?;
        if body.success {
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    pub async fn save_user(&self, user: &crate::models::PanelUser) -> Result<Vec<crate::models::PanelUser>, AppError> {
        let url = self.build_url("/api/users");
        let res = self
            .client
            .post(&url)
            .header(NODE_TOKEN_HEADER, &self.node_token)
            .header(PROTOCOL_VERSION_HEADER, PROTOCOL_VERSION.to_string())
            .json(user)
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(AppError::Message(format!(
                "Daemon returned HTTP {}",
                res.status()
            )));
        }

        let body: ApiResponse<Vec<crate::models::PanelUser>> = res.json().await?;
        if body.success {
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    pub async fn delete_user(&self, username: &str) -> Result<Vec<crate::models::PanelUser>, AppError> {
        let url = self.build_url(&format!("/api/users/{}", urlencoding::encode(username)));
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

        let body: ApiResponse<Vec<crate::models::PanelUser>> = res.json().await?;
        if body.success {
            Ok(body.data.unwrap_or_default())
        } else {
            Err(AppError::Message(
                body.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }
}
