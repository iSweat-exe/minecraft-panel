use crate::error::AppError;
use jsonwebtoken::{encode, EncodingKey, Header};
use protocol::{
    ApiResponse, ContainerSpec, DaemonClaims, DaemonInfoResponse, PowerActionRequest,
    PowerActionResponse, ServerPowerAction, ServerStatusResponse, NODE_TOKEN_HEADER,
    PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER, PANEL_USER_HEADER,
};
use reqwest::{Client, Method};
use std::sync::OnceLock;
use std::time::Duration;

static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

pub struct DaemonClient {
    node_url: String,
    node_token: String,
    username: Option<String>,
    client: Client,
}

impl DaemonClient {
    pub fn new(node_url: impl Into<String>, node_token: impl Into<String>) -> Self {
        let client = HTTP_CLIENT.get_or_init(|| {
            Client::builder()
                .timeout(Duration::from_secs(300))
                .build()
                .unwrap_or_default()
        }).clone();

        let mut url = node_url.into();
        if url.ends_with('/') {
            url.pop();
        }

        let raw_token = node_token.into();
        let mut actual_token = raw_token.clone();
        let mut username = None;

        if let Some(idx) = raw_token.find("::") {
            actual_token = raw_token[..idx].to_string();
            let user_part = &raw_token[idx + 2..];
            if !user_part.is_empty() {
                username = Some(user_part.to_string());
            }
        }

        Self {
            node_url: url,
            node_token: actual_token,
            username,
            client,
        }
    }

    fn build_url(&self, path: &str) -> String {
        format!("{}{}", self.node_url, path)
    }

    async fn request<T: serde::de::DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> Result<T, AppError> {
        let url = self.build_url(path);
        let mut req = self
            .client
            .request(method, &url)
            .header(NODE_TOKEN_HEADER, &self.node_token)
            .header(PROTOCOL_VERSION_HEADER, PROTOCOL_VERSION.to_string());

        if let Some(ref user) = self.username {
            req = req.header(PANEL_USER_HEADER, user);
        }

        if let Some(b) = body {
            req = req.json(&b);
        }

        let res = req
            .send()
            .await
            .map_err(|e| AppError::Message(format!("Network error: {}", e)))?;
        let status = res.status();

        if !status.is_success() {
            if let Ok(api_res) = res.json::<ApiResponse<()>>().await {
                return Err(AppError::Message(
                    api_res.error.unwrap_or_else(|| format!("HTTP {}", status)),
                ));
            }
            return Err(AppError::Message(format!("Daemon returned HTTP {}", status)));
        }

        let api_res: ApiResponse<T> = res
            .json()
            .await
            .map_err(|e| AppError::Message(format!("JSON parsing error: {}", e)))?;
            
        if api_res.success {
            api_res.data.ok_or_else(|| AppError::Message("Missing response data".into()))
        } else {
            Err(AppError::Message(
                api_res.error.unwrap_or_else(|| "Unknown daemon error".into()),
            ))
        }
    }

    /// Fetch daemon info (version, uptime, total servers, running servers)
    pub async fn get_info(&self) -> Result<DaemonInfoResponse, AppError> {
        self.request(Method::GET, "/api/v1/info", None).await
    }

    /// List all managed containers on the node
    pub async fn list_servers(&self) -> Result<Vec<ServerStatusResponse>, AppError> {
        self.request(Method::GET, "/api/v1/servers", None).await
    }

    /// Create a new server container on the node
    pub async fn create_server(&self, spec: ContainerSpec) -> Result<String, AppError> {
        let payload = serde_json::to_value(protocol::CreateServerRequest { spec })
            .map_err(|e| AppError::Message(e.to_string()))?;
        self.request(Method::POST, "/api/v1/servers", Some(payload)).await
    }

    /// Trigger power action (start, stop, restart, kill) on a server container
    pub async fn power_action(
        &self,
        server_id: &str,
        action: ServerPowerAction,
    ) -> Result<PowerActionResponse, AppError> {
        let payload = serde_json::to_value(PowerActionRequest { action })
            .map_err(|e| AppError::Message(e.to_string()))?;
        self.request(Method::POST, &format!("/api/v1/servers/{}/power", server_id), Some(payload)).await
    }

    /// Inspect a server container
    pub async fn inspect_container(&self, server_id: &str) -> Result<serde_json::Value, AppError> {
        self.request(Method::GET, &format!("/api/v1/servers/{}/inspect", server_id), None).await
    }

    /// Send a console command to a server container
    pub async fn send_command(&self, server_id: &str, command: &str) -> Result<String, AppError> {
        let payload = serde_json::json!({ "command": command });
        self.request(Method::POST, &format!("/api/v1/servers/{}/command", server_id), Some(payload)).await
    }

    /// Send multiple RCON commands to a server and get their responses
    pub async fn rcon_execute_multi(
        &self,
        server_id: &str,
        commands: Vec<String>,
    ) -> Result<Vec<String>, AppError> {
        let payload = serde_json::json!({ "commands": commands });
        self.request(Method::POST, &format!("/api/v1/servers/{}/rcon_multi", server_id), Some(payload)).await
    }

    /// Delete a server container on the node
    pub async fn delete_server(&self, server_id: &str) -> Result<String, AppError> {
        self.request(Method::DELETE, &format!("/api/v1/servers/{}", server_id), None).await
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
        self.request(Method::GET, "/api/v1/metrics", None).await
    }

    pub async fn list_dir(&self, path: &str) -> Result<Vec<protocol::FileEntry>, AppError> {
        self.request(Method::GET, &format!("/api/v1/files/list?path={}", urlencoding::encode(path)), None).await
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
            .await
            .map_err(|e| AppError::Message(format!("Network error: {}", e)))?;

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
        let payload = serde_json::to_value(protocol::FileWriteRequest { content })
            .map_err(|e| AppError::Message(e.to_string()))?;
        self.request::<String>(Method::POST, &format!("/api/v1/files/write?path={}", urlencoding::encode(path)), Some(payload))
            .await
            .map(|_| ())
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
            .await
            .map_err(|e| AppError::Message(format!("Network error: {}", e)))?;

        let status = res.status();
        if !status.is_success() {
            if let Ok(api_res) = res.json::<ApiResponse<()>>().await {
                return Err(AppError::Message(
                    api_res.error.unwrap_or_else(|| format!("HTTP {}", status)),
                ));
            }
            return Err(AppError::Message(format!("Daemon returned HTTP {}", status)));
        }

        let body: ApiResponse<String> = res.json().await
            .map_err(|e| AppError::Message(format!("JSON error: {}", e)))?;
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
        let payload = serde_json::to_value(protocol::FileActionRequest { action })
            .map_err(|e| AppError::Message(e.to_string()))?;
        self.request::<String>(Method::POST, &format!("/api/v1/files/action?path={}", urlencoding::encode(path)), Some(payload))
            .await
            .map(|_| ())
    }

    pub async fn get_system_host(&self) -> Result<protocol::SystemHostResponse, AppError> {
        self.request(Method::GET, "/api/v1/system/host", None).await
    }

    pub async fn get_system_health(&self) -> Result<protocol::SystemHealthResponse, AppError> {
        self.request(Method::GET, "/api/v1/system/health", None).await
    }

    pub async fn get_system_logs(
        &self,
        lines: Option<usize>,
    ) -> Result<protocol::ServerLogsResponse, AppError> {
        let lines_query = lines.unwrap_or(100);
        self.request(Method::GET, &format!("/api/v1/system/logs?lines={}", lines_query), None).await
    }

    pub async fn get_server_ping(
        &self,
        server_id: &str,
    ) -> Result<protocol::MinecraftPingResponse, AppError> {
        self.request(Method::GET, &format!("/api/v1/servers/{}/ping", server_id), None).await
    }

    pub async fn get_server_crashes(
        &self,
        server_id: &str,
    ) -> Result<protocol::ServerCrashesResponse, AppError> {
        self.request(Method::GET, &format!("/api/v1/servers/{}/crashes", server_id), None).await
    }

    pub async fn get_server_logs(
        &self,
        server_id: &str,
        lines: Option<usize>,
    ) -> Result<protocol::ServerLogsResponse, AppError> {
        let lines_query = lines.unwrap_or(100);
        self.request(Method::GET, &format!("/api/v1/servers/{}/logs?lines={}", server_id, lines_query), None).await
    }

    pub async fn docker_list_containers(
        &self,
    ) -> Result<Vec<protocol::DockerContainerInfo>, AppError> {
        self.request(Method::GET, "/api/v1/system/docker/containers", None).await
    }

    pub async fn docker_list_images(&self) -> Result<Vec<protocol::DockerImageInfo>, AppError> {
        self.request(Method::GET, "/api/v1/system/docker/images", None).await
    }

    pub async fn docker_container_action(
        &self,
        id: &str,
        action: &str,
    ) -> Result<String, AppError> {
        let payload = serde_json::json!({ "action": action });
        self.request(Method::POST, &format!("/api/v1/system/docker/containers/{}/action", id), Some(payload)).await
    }

    pub async fn docker_container_logs(&self, id: &str, tail: Option<u32>) -> Result<String, AppError> {
        let tail_str = tail.map(|t| t.to_string()).unwrap_or_else(|| "150".to_string());
        self.request(Method::GET, &format!("/api/v1/system/docker/containers/{}/logs?tail={}", id, tail_str), None).await
    }

    pub async fn docker_container_inspect(&self, id: &str) -> Result<String, AppError> {
        self.request(Method::GET, &format!("/api/v1/system/docker/containers/{}/inspect", id), None).await
    }

    pub async fn docker_run_container(
        &self,
        req: protocol::DockerRunRequest,
    ) -> Result<String, AppError> {
        let payload = serde_json::to_value(req).map_err(|e| AppError::Message(e.to_string()))?;
        self.request(Method::POST, "/api/v1/system/docker/containers", Some(payload)).await
    }

    pub async fn docker_update_container(
        &self,
        id: &str,
        req: protocol::DockerUpdateRequest,
    ) -> Result<String, AppError> {
        let payload = serde_json::to_value(req).map_err(|e| AppError::Message(e.to_string()))?;
        self.request(Method::PUT, &format!("/api/v1/system/docker/containers/{}", id), Some(payload)).await
    }

    pub async fn docker_recreate_container(
        &self,
        id: &str,
        req: protocol::DockerRunRequest,
    ) -> Result<String, AppError> {
        let payload = serde_json::to_value(req).map_err(|e| AppError::Message(e.to_string()))?;
        self.request(Method::POST, &format!("/api/v1/system/docker/containers/{}/recreate", id), Some(payload)).await
    }

    pub async fn docker_pull_image(&self, image_name: &str) -> Result<String, AppError> {
        let payload = serde_json::json!({ "image_name": image_name });
        self.request(Method::POST, "/api/v1/system/docker/images/pull", Some(payload)).await
    }

    pub async fn docker_remove_image(&self, id: &str) -> Result<String, AppError> {
        self.request(Method::DELETE, &format!("/api/v1/system/docker/images/{}", id), None).await
    }

    pub async fn docker_system_prune(&self) -> Result<String, AppError> {
        self.request(Method::POST, "/api/v1/system/docker/prune", None).await
    }

    pub async fn api_request(
        &self,
        method: &str,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> Result<serde_json::Value, AppError> {
        let req_method = match method.to_uppercase().as_str() {
            "GET" => Method::GET,
            "POST" => Method::POST,
            "PUT" => Method::PUT,
            "DELETE" => Method::DELETE,
            _ => return Err(AppError::Message("Invalid HTTP method".into())),
        };
        
        let url = self.build_url(path);
        let mut req = self
            .client
            .request(req_method, &url)
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
        self.request(Method::GET, "/api/users", None).await
    }

    pub async fn save_user(&self, user: &crate::models::PanelUser) -> Result<Vec<crate::models::PanelUser>, AppError> {
        let payload = serde_json::to_value(user).map_err(|e| AppError::Message(e.to_string()))?;
        self.request(Method::POST, "/api/users", Some(payload)).await
    }

    pub async fn delete_user(&self, username: &str) -> Result<Vec<crate::models::PanelUser>, AppError> {
        self.request(Method::DELETE, &format!("/api/users/{}", urlencoding::encode(username)), None).await
    }
}
