pub mod commands;
pub mod error;
pub mod ssh;
pub mod state;
pub mod models;
pub mod transfer;
pub mod protocol;
pub mod node_client;

use state::SshState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SshState::new())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::connection::ssh_connect,
            commands::connection::ssh_status,
            commands::connection::ssh_disconnect,
            commands::connection::ssh_execute,
            commands::service::service_action,
            commands::service::service_status,
            commands::console::console_subscribe,
            commands::console::console_unsubscribe,
            commands::console::console_send_command,
            commands::ping::mc_ping,
            commands::metrics::metrics_subscribe,
            commands::metrics::metrics_unsubscribe,
            commands::sftp::sftp_list_dir,
            commands::sftp::sftp_read_file,
            commands::sftp::sftp_write_file,
            commands::sftp::sftp_delete,
            commands::sftp::sftp_rename,
            commands::sftp::sftp_mkdir,
            commands::sftp::ssh_copy,
            commands::sftp::sftp_read_file_base64,
            commands::sftp::ssh_download_remote,
            transfer::upload::sftp_upload_file,
            transfer::download::sftp_download_file,
            transfer::cancel_backup,
            commands::rcon::rcon_execute,
            commands::rcon::rcon_execute_multi,
            commands::players::get_players_list,
            commands::users::get_panel_users,
            commands::users::save_panel_user,
            commands::users::delete_panel_user,
            commands::users::verify_panel_user,
            commands::docker::docker_list_containers,
            commands::docker::docker_container_action,
            commands::docker::docker_system_prune,
            commands::docker::docker_container_logs,
            commands::docker::docker_list_images,
            commands::docker::docker_pull_image,
            commands::docker::docker_remove_image,
            commands::docker::docker_run_container,
            commands::docker::docker_inspect_container,
            commands::docker::docker_update_container,
            commands::docker::docker_recreate_container,
            commands::terminal::terminal_start,
            commands::terminal::terminal_write,
            commands::terminal::terminal_resize,
            commands::node::node_get_info,
            commands::node::node_list_servers,
            commands::node::node_create_server,
            commands::node::node_power_action,
            commands::node::node_delete_server,
            commands::node::node_generate_console_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

