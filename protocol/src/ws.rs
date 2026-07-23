use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data", rename_all = "snake_case")]
pub enum ClientWsMessage {
    /// Request to attach to console stream of a server
    AttachConsole { server_id: String },
    /// Execute a console command in the server container
    SendCommand { command: String },
    /// Resize terminal dimensions
    ResizePty { cols: u16, rows: u16 },
    /// Heartbeat ping
    Ping,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data", rename_all = "snake_case")]
pub enum DaemonWsMessage {
    /// Console output line from stdout or stderr
    ConsoleOutput { server_id: String, line: String },
    /// Server state change event (e.g. running, stopped)
    StatusEvent { server_id: String, state: String },
    /// Resource usage metrics event
    StatsEvent {
        server_id: String,
        cpu_percent: f64,
        memory_used_mb: u64,
        memory_total_mb: u64,
    },
    /// Heartbeat pong
    Pong,
    /// Error message
    Error { message: String },
}
