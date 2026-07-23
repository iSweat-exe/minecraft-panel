use crate::error::AppError;
use crate::state::SshState;
use russh::ChannelMsg;
use std::time::Duration;
use tokio::time::timeout;

const RCON_AUTH: i32 = 3;
const RCON_EXEC_COMMAND: i32 = 2;
const RCON_EXEC_RESPONSE: i32 = 0;

pub async fn send_rcon_packet(
    channel: &mut russh::Channel<russh::client::Msg>,
    request_id: i32,
    packet_type: i32,
    payload: &str,
) -> Result<(), AppError> {
    let payload_bytes = payload.as_bytes();
    let length = 10 + payload_bytes.len() as i32;

    let mut buf = Vec::new();
    buf.extend_from_slice(&length.to_le_bytes());
    buf.extend_from_slice(&request_id.to_le_bytes());
    buf.extend_from_slice(&packet_type.to_le_bytes());
    buf.extend_from_slice(payload_bytes);
    buf.push(0);
    buf.push(0);

    channel.data(&buf[..]).await.map_err(|e| AppError::Message(e.to_string()))?;
    Ok(())
}

pub async fn read_rcon_packet(
    channel: &mut russh::Channel<russh::client::Msg>,
    timeout_duration: Duration,
) -> Result<(i32, i32, String), AppError> {
    let mut buf = Vec::new();
    
    let result = timeout(timeout_duration, async {
        while let Some(msg) = channel.wait().await {
            if let ChannelMsg::Data { ref data } = msg {
                buf.extend_from_slice(data);
                if buf.len() >= 4 {
                    let length = i32::from_le_bytes(buf[0..4].try_into().unwrap()) as usize;
                    if buf.len() >= 4 + length {
                        let body_buf = &buf[4..4+length];
                        let request_id = i32::from_le_bytes(body_buf[0..4].try_into().unwrap());
                        let packet_type = i32::from_le_bytes(body_buf[4..8].try_into().unwrap());
                        let payload_len = length.saturating_sub(10);
                        let payload_bytes = &body_buf[8..8 + payload_len];
                        let payload = String::from_utf8_lossy(payload_bytes).to_string();
                        return Ok((request_id, packet_type, payload));
                    }
                }
            }
        }
        Err(AppError::Message("Connection closed".into()))
    }).await;

    match result {
        Ok(res) => res,
        Err(_) => Err(AppError::Message("RCON Timeout".into()))
    }
}

pub async fn execute_multi(
    cmds: Vec<String>,
    port: u16,
    password: String,
    state: &tauri::State<'_, SshState>,
) -> Result<Vec<String>, AppError> {
    let mut rcon_guard = state.rcon_channel.lock().await;
    let timeout_dur = Duration::from_secs(5);

    if rcon_guard.is_none() {
        let mut session_guard = state.session.lock().await;
        let session = session_guard.as_mut().ok_or_else(|| AppError::Message("Not connected".into()))?;

        // Open direct TCP/IP channel to localhost:port on the remote server
        let mut channel = session.channel_open_direct_tcpip("127.0.0.1", port as u32, "127.0.0.1", 0).await?;
        drop(session_guard);

        // Send Auth
        send_rcon_packet(&mut channel, 1, RCON_AUTH, &password).await?;
        
        // Read Auth Response
        let (id, ptype, _) = read_rcon_packet(&mut channel, timeout_dur).await?;
        
        let (final_id, _, _) = if ptype == RCON_EXEC_RESPONSE {
            read_rcon_packet(&mut channel, timeout_dur).await?
        } else {
            (id, ptype, "".to_string())
        };

        if final_id == -1 {
            let _ = channel.eof().await;
            let _ = channel.close().await;
            return Err(AppError::Message("RCON Authentication Failed".into()));
        }

        *rcon_guard = Some(channel);
    }

    let channel = rcon_guard.as_mut().unwrap();
    let mut responses = Vec::new();

    for (i, cmd) in cmds.iter().enumerate() {
        let request_id = 2 + i as i32;
        if let Err(e) = send_rcon_packet(channel, request_id, RCON_EXEC_COMMAND, &cmd).await {
            *rcon_guard = None;
            return Err(e);
        }
        
        let mut response_text = String::new();
        match read_rcon_packet(channel, timeout_dur).await {
            Ok((res_id, res_ptype, payload)) => {
                if res_id == request_id && res_ptype == RCON_EXEC_RESPONSE {
                    response_text.push_str(&payload);
                }
            },
            Err(e) => {
                *rcon_guard = None;
                return Err(e);
            }
        }
        responses.push(response_text);
    }

    Ok(responses)
}
