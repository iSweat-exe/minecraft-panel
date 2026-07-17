use crate::error::AppError;
use crate::state::SshState;
use crate::ssh::exec::run_exec;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct McPing {
    pub online: bool,
    pub players_online: Option<u32>,
    pub players_max: Option<u32>,
    pub latency_ms: Option<u64>,
}

/// Pings the MC server from the remote host by attempting a TCP connection
/// and reading the server list ping response. This avoids depending on
/// any third-party API — we run a small script on the server itself.
#[tauri::command]
pub async fn mc_ping(state: State<'_, SshState>) -> Result<McPing, AppError> {
    // Use netcat to do a basic MC status ping from the server itself.
    // We send a Server List Ping packet and parse the JSON response.
    // Fallback: just try to connect to port 25565 and see if it responds.
    let script = r#"python3 -c "
import socket, struct, json, time
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(3)
    t0 = time.time()
    s.connect(('127.0.0.1', 25565))
    lat = int((time.time() - t0) * 1000)
    # Handshake packet
    host = b'127.0.0.1'
    data = b'\x00'  # packet id
    data += b'\xff\x05'  # protocol version (varint -1)
    data += bytes([len(host)]) + host
    data += struct.pack('>H', 25565)
    data += b'\x01'  # next state: status
    pkt = bytes([len(data)]) + data
    s.sendall(pkt)
    # Status request
    s.sendall(b'\x01\x00')
    # Read response
    def read_varint(sock):
        val = 0
        for i in range(5):
            b = sock.recv(1)
            if not b: return -1
            val |= (b[0] & 0x7F) << (7 * i)
            if not (b[0] & 0x80): break
        return val
    _pkt_len = read_varint(s)
    _pkt_id = read_varint(s)
    str_len = read_varint(s)
    resp = b''
    while len(resp) < str_len:
        resp += s.recv(str_len - len(resp))
    s.close()
    j = json.loads(resp)
    p = j.get('players', {})
    print(json.dumps({'online': True, 'players_online': p.get('online', 0), 'players_max': p.get('max', 0), 'latency_ms': lat}))
except Exception:
    print(json.dumps({'online': False}))
" 2>/dev/null"#;

    let out = run_exec(&state, script).await?;
    let trimmed = out.trim();

    if let Ok(ping) = serde_json::from_str::<McPing>(trimmed) {
        Ok(ping)
    } else {
        Ok(McPing {
            online: false,
            players_online: None,
            players_max: None,
            latency_ms: None,
        })
    }
}
