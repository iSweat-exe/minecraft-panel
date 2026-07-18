pub mod commands;
pub mod error;
pub mod ssh;
pub mod state;
pub mod models;

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
            commands::connection::ssh_execute,
            commands::service::service_action,
            commands::service::service_status,
            commands::console::console_subscribe,
            commands::console::console_send_command,
            commands::ping::mc_ping,
            commands::metrics::metrics_subscribe,
            commands::sftp::sftp_list_dir,
            commands::sftp::sftp_read_file,
            commands::sftp::sftp_write_file,
            commands::sftp::sftp_delete,
            commands::sftp::sftp_rename,
            commands::sftp::sftp_mkdir,
            commands::sftp::ssh_copy,
            commands::sftp::sftp_upload_file,
            commands::sftp::sftp_read_file_base64,
            commands::sftp::sftp_download_file,
            commands::sftp::cancel_backup,
            commands::rcon::rcon_execute,
            commands::rcon::rcon_execute_multi
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
