use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub enum PortProtocol {
    Tcp,
    Udp,
}

impl fmt::Display for PortProtocol {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PortProtocol::Tcp => write!(f, "tcp"),
            PortProtocol::Udp => write!(f, "udp"),
        }
    }
}

impl From<&str> for PortProtocol {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "udp" => PortProtocol::Udp,
            _ => PortProtocol::Tcp,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct PortMapping {
    pub host_port: u16,
    pub container_port: u16,
    pub protocol: PortProtocol,
}
