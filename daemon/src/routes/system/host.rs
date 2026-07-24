use axum::Json;
use protocol::{ApiResponse, SystemHostResponse};

use crate::auth::NodeAuth;
use tokio::process::Command;

pub async fn get_host(_auth: NodeAuth) -> Json<ApiResponse<SystemHostResponse>> {
    let mut sys = sysinfo::System::new();
    sys.refresh_cpu_all();

    let disks = sysinfo::Disks::new_with_refreshed_list();

    let os_name = sysinfo::System::name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = sysinfo::System::os_version().unwrap_or_else(|| "Unknown".to_string());
    let kernel_version = sysinfo::System::kernel_version().unwrap_or_else(|| "Unknown".to_string());

    let cpu_cores = sys.cpus().len();
    let cpu_model = if cpu_cores > 0 {
        sys.cpus()[0].brand().to_string()
    } else {
        "Unknown".to_string()
    };
    let cpu_freq_mhz = if cpu_cores > 0 {
        sys.cpus()[0].frequency()
    } else {
        0
    };

    let mut disk_total_mb = 0;
    let mut disk_free_mb = 0;

    for disk in disks.list() {
        disk_total_mb += disk.total_space() / 1024 / 1024;
        disk_free_mb += disk.available_space() / 1024 / 1024;
    }

    Json(ApiResponse::ok(SystemHostResponse {
        os_name,
        os_version,
        kernel_version,
        cpu_model,
        cpu_cores,
        cpu_freq_mhz,
        disk_total_mb,
        disk_free_mb,
    }))
}

pub async fn execute_command(
    _auth: NodeAuth,
    Json(payload): Json<protocol::HostExecRequest>,
) -> Json<ApiResponse<protocol::HostExecResponse>> {
    #[cfg(target_os = "windows")]
    let output_result = {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", &payload.command]);
        cmd.output().await
    };

    #[cfg(not(target_os = "windows"))]
    let output_result = {
        let bash_wrapper = "shopt -s expand_aliases; \
            alias ls='ls --color=auto'; \
            alias grep='grep --color=auto'; \
            alias egrep='egrep --color=auto'; \
            alias fgrep='fgrep --color=auto'; \
            alias ip='ip -color=auto'; \
            alias tree='tree -C'; \
            eval \"$HOST_EXEC_CMD\"";

        let mut script_cmd = Command::new("script");
        script_cmd.args(["-q", "-e", "-c", bash_wrapper, "/dev/null"])
            .env("SHELL", "/bin/bash")
            .env("HOST_EXEC_CMD", &payload.command)
            .env("TERM", "xterm-256color")
            .env("COLORTERM", "truecolor")
            .env("CLICOLOR_FORCE", "1")
            .env("FORCE_COLOR", "1");
        
        match script_cmd.output().await {
            Ok(output) => Ok(output),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                let mut sh_cmd = Command::new("bash");
                sh_cmd.args(["-c", bash_wrapper])
                    .env("HOST_EXEC_CMD", &payload.command)
                    .env("TERM", "xterm-256color")
                    .env("COLORTERM", "truecolor")
                    .env("CLICOLOR_FORCE", "1")
                    .env("FORCE_COLOR", "1");
                sh_cmd.output().await
            }
            Err(e) => Err(e),
        }
    };

    match output_result {
        Ok(output) => {
            let mut stdout = String::from_utf8_lossy(&output.stdout).to_string();
            // script command often leaves \r\n, but sometimes we just want to pass the raw output to xterm.
            // xterm handles \r\n natively.
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Json(ApiResponse::ok(protocol::HostExecResponse {
                stdout,
                stderr,
                exit_code: output.status.code(),
            }))
        }
        Err(e) => Json(ApiResponse::err(format!(
            "Failed to execute command: {}",
            e
        ))),
    }
}
