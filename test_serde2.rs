use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileAction {
    Rename { new_name: String },
    Copy { destination: String },
    Delete,
    Mkdir,
    Archive { archive_name: String },
    Extract,
}

fn main() {
    println!("{}", serde_json::to_string(&FileAction::Delete).unwrap());
    println!("{}", serde_json::to_string(&FileAction::Rename { new_name: "test".into() }).unwrap());
}
