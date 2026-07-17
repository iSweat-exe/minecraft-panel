pub mod commands;
pub mod error;
pub mod ssh;
pub mod state;

use state::SshState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SshState::new())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::connection::ssh_connect,
            commands::connection::ssh_status,
            commands::connection::ssh_disconnect,
            commands::service::service_action,
            commands::service::service_status,
            commands::console::console_subscribe,
            commands::console::console_send_command,
            commands::ping::mc_ping,
            commands::metrics::system_metrics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
