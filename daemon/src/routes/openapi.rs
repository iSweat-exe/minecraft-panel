use crate::routes::v1::auth::{LoginRequest, LoginResponse};
use crate::routes::v1::automations::Automation;
use crate::routes::v1::docker::containers::{
    ContainerLogsQuery, DockerActionPayload, SystemPrunePayload,
};
use crate::routes::v1::docker::images::PullImagePayload;
use crate::routes::v1::history::HistoryEntry;
use crate::routes::v1::servers::backups::{BackupInfo, CreateBackupRequest, TaskResponse};
use crate::routes::v1::servers::command::{ServerCommandRequest, ServerRconMultiRequest};
use crate::routes::v1::servers::files::FileQuery;
use crate::routes::v1::sessions::Session;
use crate::routes::v1::users::{CreateUserRequest, PatchUserRequest, UserResponse};
use protocol::api::*;
use protocol::docker::*;
use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::{Modify, OpenApi};
// ... other local schemas

struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer_auth",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            )
        }
    }
}

#[derive(OpenApi)]
#[openapi(
    paths(
        crate::routes::v1::auth::login,
        crate::routes::v1::users::list_users,
        crate::routes::v1::users::save_user,
        crate::routes::v1::users::delete_user,
        crate::routes::v1::users::patch_user,
        crate::routes::v1::sessions::list_sessions,
        crate::routes::v1::sessions::save_session,
        crate::routes::v1::sessions::delete_session,
        crate::routes::v1::automations::list_automations,
        crate::routes::v1::automations::save_automation,
        crate::routes::v1::automations::delete_automation,
        crate::routes::v1::discovery::get_api_endpoints,
        crate::routes::v1::discovery::get_metadata,
        crate::routes::v1::history::list_history,
        crate::routes::v1::history::save_history,
        crate::routes::v1::docker::images::list_all_images,
        crate::routes::v1::docker::images::pull_image,
        crate::routes::v1::docker::images::remove_image,
        crate::routes::v1::docker::config::get_docker_config,
        crate::routes::v1::docker::config::update_docker_config,
        crate::routes::v1::docker::containers::list_all_containers,
        crate::routes::v1::docker::containers::container_action,
        crate::routes::v1::docker::containers::container_logs,
        crate::routes::v1::docker::containers::container_inspect,
        crate::routes::v1::docker::containers::system_prune,
        crate::routes::v1::docker::containers::run_container,
        crate::routes::v1::docker::containers::recreate_container,
        crate::routes::v1::node::info::get_info,
        crate::routes::v1::node::metrics::get_metrics,
        crate::routes::v1::node::update::trigger_update,
        crate::routes::v1::node::allocations::list_allocations,
        crate::routes::v1::node::crontab::get_crontab,
        crate::routes::v1::node::crontab::update_crontab,
        crate::routes::v1::node::memory::get_memory,
        crate::routes::v1::node::host::get_host,
        crate::routes::v1::node::host::execute_command,
        crate::routes::v1::node::pty::host_pty_ws,
        crate::routes::v1::node::health::get_health,
        crate::routes::v1::node::logs::get_logs,
        crate::routes::v1::servers::list::list_servers,
        crate::routes::v1::servers::list::get_server,
        crate::routes::v1::servers::create::create_server,
        crate::routes::v1::servers::patch::patch_server,
        crate::routes::v1::servers::delete::delete_server,
        crate::routes::v1::servers::power::server_power,
        crate::routes::v1::servers::command::server_command,
        crate::routes::v1::servers::command::server_rcon_multi,
        crate::routes::v1::servers::inspect::server_inspect,
        crate::routes::v1::servers::stream::ws_stream_handler,
        crate::routes::v1::servers::crashes::server_crashes,
        crate::routes::v1::servers::logs::server_logs,
        crate::routes::v1::servers::metrics::server_metrics_history,
        crate::routes::v1::servers::tasks::stream_task,
        crate::routes::v1::servers::backups::list_backups,
        crate::routes::v1::servers::backups::create_backup,
        crate::routes::v1::servers::backups::delete_backup,
        crate::routes::v1::servers::backups::restore_backup,
        crate::routes::v1::servers::backups::download_backup,
        crate::routes::v1::servers::files::list::list_files,
        crate::routes::v1::servers::files::read::read_file,
        crate::routes::v1::servers::files::write::write_file,
        crate::routes::v1::servers::files::upload::upload_file,
        crate::routes::v1::servers::files::download::download_file,
        crate::routes::v1::servers::files::action::file_action,
        crate::routes::v1::servers::files::hash::hash_file,
        crate::routes::v1::servers::files::hash::hash_multiple
        // we will add more paths here later
    ),
    components(
        schemas(
            // From protocol::api
            ServerPowerAction, CreateServerRequest, UpdateServerRequest, PatchServerRequest,
            CreateServerResponse, PowerActionRequest, PowerActionResponse, ServerStatusResponse,
            ServerMetricsHistoryData, ServerMetricsHistoryResponse, DaemonInfoResponse,
            SignedReleaseManifest, UpdateDaemonRequest, UpdateDaemonResponse,
            SystemMetricsResponse, FileEntry, FileAction, HostExecRequest, HostExecResponse,
            FileActionRequest, FileWriteRequest, FileWriteBase64Request,
            SystemMemoryResponse, DockerConfigUpdateRequest, CrontabUpdateRequest,
            FileHashResponse, FileHashMultipleRequest, FileHashMultipleResponse,
            SystemHostResponse, SystemHealthResponse, MinecraftPingPlayer, MinecraftPingResponse,
            ServerLogsResponse, ServerCrashesResponse, DockerContainerInfo, DockerImageInfo,
            DockerRunRequest, DockerUpdateRequest,
            // From protocol::docker
            ServerResources, PortMapping, VolumeMapping, ServerSpec,
            // Local
            UserResponse, CreateUserRequest, PatchUserRequest, Session, LoginRequest, LoginResponse,
            Automation, HistoryEntry, PullImagePayload, DockerActionPayload, ContainerLogsQuery, SystemPrunePayload,
            BackupInfo, CreateBackupRequest, TaskResponse, FileQuery,
            ServerCommandRequest, ServerRconMultiRequest
        )
    ),
    modifiers(&SecurityAddon),
    tags(
        (name = "daemon", description = "VPS Panel Daemon API")
    )
)]
pub struct ApiDoc;
