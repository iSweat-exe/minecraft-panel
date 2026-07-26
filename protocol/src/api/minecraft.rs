use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MinecraftPingPlayer {
    pub id: String,
    pub name: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct MinecraftPingResponse {
    pub online_players: u32,
    pub max_players: u32,
    pub motd: String,
    pub version: String,
    pub sample: Option<Vec<MinecraftPingPlayer>>,
}

