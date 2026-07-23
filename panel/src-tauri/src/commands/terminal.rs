use crate::error::AppError;
use crate::state::{SshState, TerminalAction};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;
use russh::ChannelMsg;

#[tauri::command]
pub async fn terminal_start(
    app: AppHandle,
    cols: u32,
    rows: u32,
    state: State<'_, SshState>,
) -> Result<(), AppError> {
    let mut session_guard = state.session.lock().await;
    let session = session_guard
        .as_mut()
        .ok_or_else(|| AppError::Message("Not connected".into()))?;

    // Clean up previous terminal channel sender
    {
        let mut tx_guard = state.terminal_tx.lock().await;
        *tx_guard = None;
    }

    let mut channel = session.channel_open_session().await?;
    channel
        .request_pty(
            true,
            "xterm-256color",
            cols,
            rows,
            0,
            0,
            &[],
        )
        .await?;
    channel.request_shell(true).await?;

    let (tx, mut rx) = mpsc::channel::<TerminalAction>(100);

    {
        let mut tx_guard = state.terminal_tx.lock().await;
        *tx_guard = Some(tx);
    }

    // Task handling PTY I/O
    tokio::spawn(async move {
        loop {
            tokio::select! {
                msg = channel.wait() => {
                    match msg {
                        Some(ChannelMsg::Data { data }) => {
                            let _ = app.emit("terminal-data", data.to_vec());
                        }
                        Some(ChannelMsg::ExtendedData { data, .. }) => {
                            let _ = app.emit("terminal-data", data.to_vec());
                        }
                        Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                            let _ = app.emit("terminal-exit", ());
                            break;
                        }
                        _ => {}
                    }
                }
                action = rx.recv() => {
                    match action {
                        Some(TerminalAction::Write(data)) => {
                            if channel.data(&data[..]).await.is_err() {
                                break;
                            }
                        }
                        Some(TerminalAction::Resize(c, r)) => {
                            let _ = channel.window_change(c, r, 0, 0).await;
                        }
                        None => {
                            let _ = channel.close().await;
                            break;
                        }
                    }
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn terminal_write(
    data: Vec<u8>,
    state: State<'_, SshState>,
) -> Result<(), AppError> {
    let tx_guard = state.terminal_tx.lock().await;
    if let Some(tx) = tx_guard.as_ref() {
        let _ = tx.send(TerminalAction::Write(data)).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn terminal_resize(
    cols: u32,
    rows: u32,
    state: State<'_, SshState>,
) -> Result<(), AppError> {
    let tx_guard = state.terminal_tx.lock().await;
    if let Some(tx) = tx_guard.as_ref() {
        let _ = tx.send(TerminalAction::Resize(cols, rows)).await;
    }
    Ok(())
}
