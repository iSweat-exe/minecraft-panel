pub mod api;
pub mod auth;
pub mod docker;
pub mod ws;

pub use api::*;
pub use auth::*;
pub use docker::*;
pub use ws::*;

/// Current version of the communication protocol between panel and daemon
pub const PROTOCOL_VERSION: u32 = 1;

