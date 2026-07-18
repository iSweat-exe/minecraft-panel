use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use tokio::sync::Mutex;
use russh::client::Handle;
use russh_sftp::client::SftpSession;
use crate::ssh::connection::SshHandler;

pub struct SshState {
    pub session: Arc<Mutex<Option<Handle<SshHandler>>>>,
    pub host: Arc<Mutex<Option<String>>>,
    pub console_task: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
    pub sftp: Arc<Mutex<Option<Arc<SftpSession>>>>,
    pub rcon_channel: Arc<Mutex<Option<russh::Channel<russh::client::Msg>>>>,
    pub metrics_task: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
    pub backup_cancel: Arc<AtomicBool>,
}

impl SshState {
    pub fn new() -> Self {
        Self {
            session: Arc::new(Mutex::new(None)),
            host: Arc::new(Mutex::new(None)),
            console_task: Arc::new(Mutex::new(None)),
            sftp: Arc::new(Mutex::new(None)),
            rcon_channel: Arc::new(Mutex::new(None)),
            metrics_task: Arc::new(Mutex::new(None)),
            backup_cancel: Arc::new(AtomicBool::new(false)),
        }
    }
}
