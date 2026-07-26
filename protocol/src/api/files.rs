use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct FileEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    #[serde(default)]
    pub permissions: Option<String>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum FileAction {
    Rename { new_name: String },
    Copy { destination: String },
    Delete,
    Mkdir,
    Archive { 
        archive_name: String,
        #[serde(default)]
        targets: Option<Vec<String>>
    },
    Extract,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct FileActionRequest {
    pub action: FileAction,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct FileWriteRequest {
    pub content: String, // Or base64? The Panel currently sends raw string for text files, or base64 for binaries. Let's use string.
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct FileWriteBase64Request {
    pub content_base64: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct FileHashResponse {
    pub sha1_hex: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct FileHashMultipleRequest {
    pub path: String,
    pub patterns: Vec<String>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct FileHashMultipleResponse {
    pub hashes: std::collections::HashMap<String, String>,
}

