use crate::error::AppError;
use crate::node_client::DaemonClient;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Serialize, Deserialize, Clone)]
pub struct PlayerInfo {
    pub uuid: String,
    pub name: String,
    #[serde(rename = "isOp")]
    pub is_op: bool,
    #[serde(rename = "isBanned")]
    pub is_banned: bool,
    #[serde(rename = "isWhitelisted")]
    pub is_whitelisted: bool,
    #[serde(rename = "isOnline")]
    pub is_online: bool, // Handled by ping or left false for now
}

#[derive(Deserialize)]
struct BasePlayer {
    uuid: String,
    name: String,
}

#[tauri::command]
pub async fn get_players_list(
    node_url: String,
    node_token: String,
    server_path: String,
) -> Result<Vec<PlayerInfo>, AppError> {
    let client = DaemonClient::new(node_url, node_token);

    let usercache_path = format!("{}/usercache.json", server_path);
    let ops_path = format!("{}/ops.json", server_path);
    let banned_path = format!("{}/banned-players.json", server_path);
    let whitelist_path = format!("{}/whitelist.json", server_path);

    let (usercache_res, ops_res, banned_res, whitelist_res) = tokio::join!(
        client.read_file(&usercache_path),
        client.read_file(&ops_path),
        client.read_file(&banned_path),
        client.read_file(&whitelist_path)
    );

    let parse = |res: Result<String, _>| -> Vec<BasePlayer> {
        res.ok()
            .and_then(|b64| {
                use base64::Engine;
                base64::engine::general_purpose::STANDARD.decode(&b64).ok()
            })
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_default()
    };

    let usercache = parse(usercache_res);
    let ops = parse(ops_res);
    let banned = parse(banned_res);
    let whitelist = parse(whitelist_res);

    let mut op_uuids = HashSet::new();
    for p in &ops {
        op_uuids.insert(p.uuid.clone());
    }

    let mut banned_uuids = HashSet::new();
    for p in &banned {
        banned_uuids.insert(p.uuid.clone());
    }

    let mut whitelist_uuids = HashSet::new();
    for p in &whitelist {
        whitelist_uuids.insert(p.uuid.clone());
    }

    let mut all_players_map: HashMap<String, PlayerInfo> = HashMap::new();

    for p in usercache {
        all_players_map.insert(
            p.uuid.clone(),
            PlayerInfo {
                uuid: p.uuid.clone(),
                name: p.name.clone(),
                is_op: op_uuids.contains(&p.uuid),
                is_banned: banned_uuids.contains(&p.uuid),
                is_whitelisted: whitelist_uuids.contains(&p.uuid),
                is_online: false,
            },
        );
    }

    let mut add_missing = |list: Vec<BasePlayer>, is_op, is_banned, is_whitelisted| {
        for p in list {
            if !all_players_map.contains_key(&p.uuid) {
                all_players_map.insert(
                    p.uuid.clone(),
                    PlayerInfo {
                        uuid: p.uuid,
                        name: p.name,
                        is_op,
                        is_banned,
                        is_whitelisted,
                        is_online: false,
                    },
                );
            }
        }
    };

    add_missing(ops, true, false, false);
    add_missing(banned, false, true, false);
    add_missing(whitelist, false, false, true);

    let mut result: Vec<PlayerInfo> = all_players_map.into_values().collect();
    // Sort alphabetically by name
    result.sort_by_key(|a| a.name.to_lowercase());

    Ok(result)
}
