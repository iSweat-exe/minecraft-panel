use crate::error::AppError;
use crate::state::SshState;
use tauri::State;
use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

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
pub async fn get_players_list(state: State<'_, SshState>) -> Result<Vec<PlayerInfo>, AppError> {
    let sftp = crate::commands::sftp::get_sftp_session(&state).await?;

    let (usercache_bytes, ops_bytes, banned_bytes, whitelist_bytes) = tokio::join!(
        sftp.read("/minecraft/usercache.json"),
        sftp.read("/minecraft/ops.json"),
        sftp.read("/minecraft/banned-players.json"),
        sftp.read("/minecraft/whitelist.json")
    );

    let parse = |res: Result<Vec<u8>, _>| -> Vec<BasePlayer> {
        res.ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_default()
    };

    let usercache = parse(usercache_bytes);
    let ops = parse(ops_bytes);
    let banned = parse(banned_bytes);
    let whitelist = parse(whitelist_bytes);

    let mut op_uuids = HashSet::new();
    for p in &ops { op_uuids.insert(p.uuid.clone()); }

    let mut banned_uuids = HashSet::new();
    for p in &banned { banned_uuids.insert(p.uuid.clone()); }

    let mut whitelist_uuids = HashSet::new();
    for p in &whitelist { whitelist_uuids.insert(p.uuid.clone()); }

    let mut all_players_map: HashMap<String, PlayerInfo> = HashMap::new();

    for p in usercache {
        all_players_map.insert(p.uuid.clone(), PlayerInfo {
            uuid: p.uuid.clone(),
            name: p.name.clone(),
            is_op: op_uuids.contains(&p.uuid),
            is_banned: banned_uuids.contains(&p.uuid),
            is_whitelisted: whitelist_uuids.contains(&p.uuid),
            is_online: false,
        });
    }

    let mut add_missing = |list: Vec<BasePlayer>, is_op, is_banned, is_whitelisted| {
        for p in list {
            if !all_players_map.contains_key(&p.uuid) {
                all_players_map.insert(p.uuid.clone(), PlayerInfo {
                    uuid: p.uuid,
                    name: p.name,
                    is_op,
                    is_banned,
                    is_whitelisted,
                    is_online: false,
                });
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
