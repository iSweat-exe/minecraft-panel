use std::sync::Arc;
use tokio::sync::Mutex;
use russh::client::Handle;
use crate::ssh::connection::SshHandler;

pub struct SshState {
    pub session: Arc<Mutex<Option<Handle<SshHandler>>>>,
}

impl SshState {
    pub fn new() -> Self {
        Self {
            session: Arc::new(Mutex::new(None)),
        }
    }
}
