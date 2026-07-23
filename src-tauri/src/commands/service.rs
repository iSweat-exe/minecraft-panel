use crate::error::AppError;
use crate::state::SshState;
use crate::ssh::exec::run_exec;
use tauri::State;
use crate::models::{ServiceAction, ServiceState};

const CONTAINER_NAME: &str = "minecraft-panel-server";

fn build_docker_recreate_cmd() -> String {
    format!(
        r#"mkdir -p /minecraft
docker rm -f {0} 2>/dev/null || true

JAR_PATH=$(find /minecraft -maxdepth 2 -name "*.jar" -not -name "*installer*" -not -path "*/libraries/*" -not -path "*/mods/*" -not -path "*/plugins/*" 2>/dev/null | head -1)
if [ -n "$JAR_PATH" ] && [ -f "$JAR_PATH" ]; then
    JAR_NAME=$(basename "$JAR_PATH")
    CUSTOM_ENV="-e TYPE=CUSTOM -e CUSTOM_SERVER=$JAR_NAME"
    # Ensure jar is at root of /minecraft if it was in a subfolder
    if [ "$JAR_PATH" != "/minecraft/$JAR_NAME" ]; then
        cp "$JAR_PATH" "/minecraft/$JAR_NAME" 2>/dev/null || true
    fi
else
    CUSTOM_ENV=""
fi

docker run -d \
--name {0} \
--restart unless-stopped \
-p 80:25565 \
-p 25565:25565 \
-p 25575:25575 \
--dns 8.8.8.8 \
--dns 1.1.1.1 \
-v /minecraft:/data \
-e EULA=TRUE \
$CUSTOM_ENV \
-e OVERRIDE_SERVER_PROPERTIES=false \
-e ENABLE_RCON=true \
-e RCON_PASSWORD=minecraft \
-e RCON_PORT=25575 \
-e MEMORY=4G \
-e JVM_XX_OPTS="-Djava.net.preferIPv4Stack=true" \
itzg/minecraft-server:java25"#,
        CONTAINER_NAME
    )
}

#[tauri::command]
pub async fn service_action(action: ServiceAction, state: State<'_, SshState>) -> Result<(), AppError> {
    let inspect = run_exec(&state, &format!("docker inspect -f '{{{{.State.Status}}}}' {} 2>/dev/null || echo 'not_found'", CONTAINER_NAME)).await?;
    let status = inspect.trim();

    match action {
        ServiceAction::Start => {
            if status == "running" {
                return Ok(());
            }
            let run_cmd = build_docker_recreate_cmd();
            run_exec(&state, &run_cmd).await?;
        }
        ServiceAction::Stop => {
            run_exec(&state, &format!("docker stop -t 10 {} 2>/dev/null || docker kill {} 2>/dev/null || true", CONTAINER_NAME, CONTAINER_NAME)).await?;
        }
        ServiceAction::Restart => {
            let run_cmd = build_docker_recreate_cmd();
            run_exec(&state, &run_cmd).await?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn service_status(state: State<'_, SshState>) -> Result<ServiceState, AppError> {
    let out = run_exec(&state, &format!("docker inspect -f '{{{{.State.Status}}}}' {} 2>/dev/null || echo 'not_found'", CONTAINER_NAME)).await?;
    let status = out.trim();

    let (active_state, sub_state) = match status {
        "running" => ("active".to_string(), "running".to_string()),
        "restarting" => ("reloading".to_string(), "restarting".to_string()),
        "exited" | "stopped" | "paused" | "dead" => ("inactive".to_string(), "dead".to_string()),
        _ => ("inactive".to_string(), "not_found".to_string()),
    };

    Ok(ServiceState { active_state, sub_state })
}
