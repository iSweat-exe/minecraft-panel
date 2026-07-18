use crate::error::AppError;
use crate::state::SshState;
use serde::Deserialize;
use tauri::State;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::{Instant, Duration};
use std::io::{Read, Write};

use crate::models::{McPing, McPingSample};

fn write_varint(mut val: u32, buf: &mut Vec<u8>) {
    loop {
        let mut temp = (val & 0x7F) as u8;
        val >>= 7;
        if val != 0 {
            temp |= 0x80;
        }
        buf.push(temp);
        if val == 0 {
            break;
        }
    }
}

fn read_varint(stream: &mut TcpStream) -> std::io::Result<i32> {
    let mut num_read = 0;
    let mut result = 0;
    loop {
        let mut buf = [0u8; 1];
        stream.read_exact(&mut buf)?;
        let read = buf[0];
        let value = (read & 0x7F) as i32;
        result |= value << (7 * num_read);
        num_read += 1;
        if num_read > 5 {
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "VarInt is too big"));
        }
        if (read & 0x80) == 0 {
            break;
        }
    }
    Ok(result)
}

#[derive(Deserialize)]
struct McStatusResponse {
    players: Option<McStatusPlayers>,
}

#[derive(Deserialize)]
struct McStatusPlayers {
    max: Option<u32>,
    online: Option<u32>,
    sample: Option<Vec<McPingSample>>,
}

#[tauri::command]
pub async fn mc_ping(state: State<'_, SshState>) -> Result<McPing, AppError> {
    let host = {
        let guard = state.host.lock().await;
        guard.clone()
    };
    
    let host = match host {
        Some(h) => h,
        None => return Ok(McPing { online: false, players_online: None, players_max: None, latency_ms: None, sample: None })
    };

    let result = tokio::task::spawn_blocking(move || -> Option<McPing> {
        let start = Instant::now();
        
        let mut stream_opt = None;
        let mut used_port = 80u16;

        // Note for future developers:
        // Port 80 is tested first due to a specific host restriction.
        // Since access to firewall settings is unavailable, the user redirected
        // the default Minecraft port (25565) to port 80 to bypass the block.
        // Try port 80 first
        if let Ok(mut addrs) = format!("{}:80", host).to_socket_addrs() {
            if let Some(addr) = addrs.next() {
                if let Ok(s) = TcpStream::connect_timeout(&addr, Duration::from_secs(2)) {
                    stream_opt = Some(s);
                }
            }
        }

        // Fallback to 25565
        if stream_opt.is_none() {
            if let Ok(mut addrs) = format!("{}:25565", host).to_socket_addrs() {
                if let Some(addr) = addrs.next() {
                    if let Ok(s) = TcpStream::connect_timeout(&addr, Duration::from_secs(2)) {
                        stream_opt = Some(s);
                        used_port = 25565;
                    }
                }
            }
        }

        let mut stream = stream_opt?;
        let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
        let _ = stream.set_write_timeout(Some(Duration::from_secs(3)));

        let latency = start.elapsed().as_millis() as u64;

        // Construct handshake packet
        let mut handshake = Vec::new();
        write_varint(0x00, &mut handshake); // Packet ID
        write_varint(47, &mut handshake); // Protocol Version (47 is 1.8, works for generic pings too)
        
        let host_bytes = host.as_bytes();
        write_varint(host_bytes.len() as u32, &mut handshake);
        handshake.extend_from_slice(host_bytes);
        handshake.extend_from_slice(&used_port.to_be_bytes()); // Port
        write_varint(1, &mut handshake); // Next state: status

        let mut packet = Vec::new();
        write_varint(handshake.len() as u32, &mut packet);
        packet.extend_from_slice(&handshake);

        if stream.write_all(&packet).is_err() { return None; }

        // Status request packet
        let mut status_req = Vec::new();
        write_varint(1, &mut status_req); // Length 1
        write_varint(0x00, &mut status_req); // Packet ID 0
        if stream.write_all(&status_req).is_err() { return None; }

        // Read response
        let _len = read_varint(&mut stream).ok()?;
        let _id = read_varint(&mut stream).ok()?;
        let json_len = read_varint(&mut stream).ok()?;
        
        if json_len <= 0 || json_len > 1024 * 1024 { return None; } // Sanity check

        let mut json_bytes = vec![0u8; json_len as usize];
        if stream.read_exact(&mut json_bytes).is_err() { return None; }

        let json_str = String::from_utf8(json_bytes).ok()?;
        let parsed: McStatusResponse = serde_json::from_str(&json_str).ok()?;

        let mut ping_res = McPing {
            online: true,
            players_online: None,
            players_max: None,
            latency_ms: Some(latency),
            sample: None,
        };

        if let Some(p) = parsed.players {
            ping_res.players_online = p.online;
            ping_res.players_max = p.max;
            ping_res.sample = p.sample;
        }

        Some(ping_res)
    }).await.unwrap_or(None);

    if let Some(ping) = result {
        return Ok(ping);
    } 

    // Fallback: If direct TCP ping fails (firewall, local-only binding, etc), 
    // run the ping script locally on the server over SSH.
    let script = r#"python3 -c "
import socket, struct, json
def read_varint(sock):
    val = 0
    for i in range(5):
        b = sock.recv(1)
        if not b: return -1
        val |= (b[0] & 0x7F) << (7 * i)
        if not (b[0] & 0x80): break
    return val
host = b'127.0.0.1'
port = 25565
try:
    sock = socket.socket()
    sock.settimeout(3)
    sock.connect(('127.0.0.1', port))
    data = b'\x00\xff\x05' + bytes([len(host)]) + host + struct.pack('>H', port) + b'\x01'
    sock.send(bytes([len(data)]) + data)
    sock.send(b'\x01\x00')
    read_varint(sock)
    read_varint(sock)
    json_len = read_varint(sock)
    res = b''
    while len(res) < json_len:
        chunk = sock.recv(json_len - len(res))
        if not chunk: break
        res += chunk
    print(res.decode('utf-8', errors='ignore'))
except Exception as e:
    pass
""#;
    let start = Instant::now();
    let ssh_out = crate::ssh::exec::run_exec(&state, script).await.unwrap_or_default();
    let latency = start.elapsed().as_millis() as u64;

    if let Ok(parsed) = serde_json::from_str::<McStatusResponse>(&ssh_out.trim()) {
        let mut ping_res = McPing {
            online: true,
            players_online: None,
            players_max: None,
            latency_ms: Some(latency),
            sample: None,
        };
        if let Some(p) = parsed.players {
            ping_res.players_online = p.online;
            ping_res.players_max = p.max;
            ping_res.sample = p.sample;
        }
        return Ok(ping_res);
    }

    Ok(McPing {
        online: false,
        players_online: None,
        players_max: None,
        latency_ms: None,
        sample: None,
    })
}
