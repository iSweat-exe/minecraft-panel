use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use std::io::Read;

#[derive(Deserialize)]
#[serde(tag = "type")]
pub enum PtyControlMessage {
    #[serde(rename = "resize")]
    Resize { cols: u16, rows: u16 },
}

pub async fn host_pty_ws(
    ws: WebSocketUpgrade,
    _auth: crate::auth::NodeAuth,
) -> Response {
    ws.on_upgrade(|socket| handle_pty_socket(socket))
}

async fn handle_pty_socket(mut socket: WebSocket) {
    let pty_system = native_pty_system();
    
    let pair = match pty_system.openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    }) {
        Ok(p) => p,
        Err(e) => {
            let _ = socket.send(Message::Text(format!("Failed to open PTY: {}", e).into())).await;
            return;
        }
    };

    #[cfg(target_os = "windows")]
    let cmd = "powershell.exe";
    #[cfg(not(target_os = "windows"))]
    let cmd = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());

    let cmd_builder = CommandBuilder::new(cmd);
    
    #[cfg(not(target_os = "windows"))]
    {
        cmd_builder.env("TERM", "xterm-256color");
        cmd_builder.env("COLORTERM", "truecolor");
        
        let rc_file = "/tmp/.mcpanel_bashrc";
        let aliases = "
            if [ -f ~/.bashrc ]; then . ~/.bashrc; fi
            alias ls='ls --color=auto'
            alias grep='grep --color=auto'
            alias ip='ip -color=auto'
            alias tree='tree -C'
        ";
        let _ = std::fs::write(rc_file, aliases);
        cmd_builder.args(["--rcfile", rc_file]);
    }

    let mut child = match pair.slave.spawn_command(cmd_builder) {
        Ok(c) => c,
        Err(e) => {
            let _ = socket.send(Message::Text(format!("Failed to spawn shell: {}", e).into())).await;
            return;
        }
    };

    drop(pair.slave); // Important: drop slave in parent to avoid EOF issues

    let mut reader = pair.master.try_clone_reader().unwrap();
    let mut writer = pair.master.take_writer().unwrap();
    let master = Arc::new(Mutex::new(pair.master));

    let (mut ws_sender, mut ws_receiver) = socket.split();

    // MPSC channel to send PTY output to WS task
    let (pty_tx, mut pty_rx) = mpsc::channel::<Vec<u8>>(100);
    
    // MPSC channel to send WS input to PTY
    let (pty_write_tx, mut pty_write_rx) = mpsc::channel::<Vec<u8>>(100);

    let pty_writer_task = tokio::task::spawn_blocking(move || {
        use std::io::Write;
        while let Some(data) = pty_write_rx.blocking_recv() {
            let _ = writer.write_all(&data);
            let _ = writer.flush();
        }
    });

    let pty_to_ws = tokio::task::spawn_blocking(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let data = buf[..n].to_vec();
                    if pty_tx.blocking_send(data).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    let ws_send_task = tokio::spawn(async move {
        while let Some(data) = pty_rx.recv().await {
            if ws_sender.send(Message::Binary(data.into())).await.is_err() {
                break;
            }
        }
    });

    let ws_recv_task = tokio::spawn(async move {
        while let Some(msg) = ws_receiver.next().await {
            match msg {
                Ok(Message::Binary(data)) => {
                    let _ = pty_write_tx.send(data.to_vec()).await;
                }
                Ok(Message::Text(text)) => {
                    if let Ok(control) = serde_json::from_str::<PtyControlMessage>(&text) {
                        match control {
                            PtyControlMessage::Resize { cols, rows } => {
                                let m = master.lock().await;
                                let _ = m.resize(PtySize {
                                    rows,
                                    cols,
                                    pixel_width: 0,
                                    pixel_height: 0,
                                });
                            }
                        }
                    } else {
                        // Fallback: treat text as input data
                        let _ = pty_write_tx.send(text.as_bytes().to_vec()).await;
                    }
                }
                Ok(Message::Close(_)) => break,
                _ => {}
            }
        }
    });

    // Wait for the child process to exit
    let _ = tokio::task::spawn_blocking(move || {
        let _ = child.wait();
    }).await;

    // Clean up tasks
    ws_send_task.abort();
    ws_recv_task.abort();
    pty_to_ws.abort();
    pty_writer_task.abort();
}
