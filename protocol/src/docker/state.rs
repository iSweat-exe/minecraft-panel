use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub enum ServerState {
    Running,
    Stopped,
    Starting,
    Exited,
    NotFound,
    Error,
    Unknown,
}

impl fmt::Display for ServerState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            ServerState::Running => "running",
            ServerState::Stopped => "stopped",
            ServerState::Starting => "starting",
            ServerState::Exited => "exited",
            ServerState::NotFound => "not_found",
            ServerState::Error => "error",
            ServerState::Unknown => "unknown",
        };
        write!(f, "{}", s)
    }
}

impl From<&str> for ServerState {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "running" => ServerState::Running,
            "stopped" | "exited" => ServerState::Exited, // Or mapped logically
            "starting" => ServerState::Starting,
            "not_found" => ServerState::NotFound,
            "error" => ServerState::Error,
            _ => ServerState::Unknown,
        }
    }
}
