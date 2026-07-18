use russh::client::Handle;
use russh_sftp::client::SftpSession;

fn check_sftp(channel: russh::Channel<russh::client::Msg>) {
    let session = SftpSession::new(channel);
}

fn main() {}
