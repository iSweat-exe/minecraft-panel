pub mod commands;
pub mod error;
pub mod models;
pub mod node_client;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::players::get_players_list,
            commands::users::get_panel_users,
            commands::users::save_panel_user,
            commands::users::delete_panel_user,
            commands::users::verify_panel_user,
            commands::docker::node_docker_list_containers,
            commands::docker::node_docker_container_action,
            commands::docker::node_docker_system_prune,
            commands::docker::node_docker_container_logs,
            commands::docker::node_docker_list_images,
            commands::docker::node_docker_pull_image,
            commands::docker::node_docker_remove_image,
            commands::docker::node_docker_run_container,
            commands::docker::node_docker_inspect_container,
            commands::docker::node_docker_update_container,
            commands::docker::node_docker_recreate_container,
            commands::node::node_get_info,
            commands::node::node_list_servers,
            commands::node::node_create_server,
            commands::node::node_power_action,
            commands::node::node_send_command,
            commands::node::node_rcon_execute_multi,
            commands::node::node_inspect_container,
            commands::node::node_download_remote,
            commands::node::node_delete_server,
            commands::node::node_generate_console_token,
            commands::node::node_get_metrics,
            commands::node::node_list_dir,
            commands::node::node_read_file,
            commands::node::node_read_file_text,
            commands::node::node_write_file,
            commands::node::node_file_action,
            commands::node::node_upload_file,
            commands::node::node_download_file,
            commands::node::node_get_system_host,
            commands::node::node_get_system_health,
            commands::node::node_get_system_logs,
            commands::node::node_get_server_ping,
            commands::node::node_get_server_crashes,
            commands::node::node_get_server_logs,
            commands::node::node_api_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
