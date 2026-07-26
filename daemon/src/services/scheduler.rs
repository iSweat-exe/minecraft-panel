use crate::routes::AppState;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{error, info, warn};

pub async fn start_scheduler(state: AppState) -> anyhow::Result<JobScheduler> {
    let sched = JobScheduler::new().await?;

    // Load existing automations from DB
    #[derive(sqlx::FromRow)]
    struct DbAutomation {
        id: String,
        name: String,
        cron_expr: String,
        action_type: String,
        target_server: Option<String>,
        payload: Option<String>,
    }

    let automations = sqlx::query_as::<_, DbAutomation>(
        "SELECT id, name, cron_expr, action_type, target_server, payload FROM automations",
    )
    .fetch_all(&state.db)
    .await?;

    for auto in automations {
        let db_id = auto.id.clone();
        let name = auto.name.clone();
        let action_type = auto.action_type.clone();
        let target_server = auto.target_server.clone();
        let payload = auto.payload.clone();
        let state_clone = state.clone();

        let job = Job::new_async(auto.cron_expr.as_str(), move |_uuid, _l| {
            let name = name.clone();
            let action_type = action_type.clone();
            let target_server = target_server.clone();
            let payload = payload.clone();
            let state = state_clone.clone();
            Box::pin(async move {
                execute_automation_action(&name, &action_type, target_server, payload, state).await;
            })
        });

        match job {
            Ok(j) => {
                let uuid = sched.add(j).await?;
                state.automation_jobs.write().await.insert(db_id, uuid);
                info!("Scheduled automation: {}", auto.name);
            }
            Err(e) => {
                error!("Failed to create job for automation {}: {}", auto.name, e);
            }
        }
    }

    sched.start().await?;
    info!("Scheduler started");

    Ok(sched)
}

/// Helper to schedule a single automation job and map it in state
pub async fn schedule_automation_job(
    state: &AppState,
    db_id: String,
    name: String,
    cron_expr: String,
    action_type: String,
    target_server: Option<String>,
    payload: Option<String>,
) -> anyhow::Result<()> {
    let sched = match &state.scheduler {
        Some(s) => s,
        None => return Ok(()),
    };

    let state_clone = state.clone();
    let name_clone = name.clone();

    let job = Job::new_async(cron_expr.as_str(), move |_uuid, _l| {
        let name = name_clone.clone();
        let action_type = action_type.clone();
        let target_server = target_server.clone();
        let payload = payload.clone();
        let state = state_clone.clone();
        Box::pin(async move {
            execute_automation_action(&name, &action_type, target_server, payload, state).await;
        })
    })?;

    let uuid = sched.add(job).await?;
    state.automation_jobs.write().await.insert(db_id, uuid);
    tracing::info!("Dynamically scheduled automation: {}", name);

    Ok(())
}

/// Dispatcher for scheduled automation job actions
pub(crate) async fn execute_automation_action(
    name: &str,
    action_type: &str,
    target_server: Option<String>,
    payload: Option<String>,
    state: AppState,
) {
    info!(job_name = %name, action_type = %action_type, "Executing scheduled automation job");

    let server_id = match target_server {
        Some(s) => s,
        None => {
            warn!(job_name = %name, "Automation requires target_server but it was empty");
            return;
        }
    };

    match action_type {
        "backup" => {
            info!(job_name = %name, server_id = %server_id, "Automation: Scheduled server backup initiated");

            let source_dir = format!("{}/{}", state.config.data_dir, server_id);
            let backup_dir = format!("{}/backups/{}", state.config.data_dir, server_id);
            let _ = tokio::fs::create_dir_all(&backup_dir).await;

            let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
            let backup_name = format!("auto_{}.tar.gz", ts);
            let backup_path = format!("{}/{}", backup_dir, backup_name);

            let output = tokio::process::Command::new("tar")
                .arg("-czf")
                .arg(&backup_path)
                .arg("-C")
                .arg(&source_dir)
                .arg(".")
                .output()
                .await;

            match output {
                Ok(out) if out.status.success() => {
                    info!(job_name = %name, backup = %backup_name, "Automation: Backup created successfully");
                }
                Ok(out) => {
                    error!(job_name = %name, "Automation: Backup failed: {}", String::from_utf8_lossy(&out.stderr));
                }
                Err(e) => {
                    error!(job_name = %name, "Automation: Backup error: {}", e);
                }
            }
        }
        "restart" => {
            info!(job_name = %name, server_id = %server_id, "Automation: Scheduled server restart initiated");
            if let Err(e) = state
                .docker
                .power_action(&server_id, protocol::ServerPowerAction::Restart)
                .await
            {
                error!(job_name = %name, "Automation: Restart failed: {}", e);
            }
        }
        "command" => {
            let cmd = match payload {
                Some(p) => p,
                None => {
                    warn!(job_name = %name, "Automation: Command action requires payload");
                    return;
                }
            };
            info!(job_name = %name, server_id = %server_id, command = %cmd, "Automation: Scheduled RCON command dispatched");
            if let Err(e) = state.console_mgr.send_command(&server_id, &cmd).await {
                error!(job_name = %name, "Automation: Command failed: {}", e);
            }
        }
        other => {
            info!(job_name = %name, action_type = %other, "Automation: Unknown/custom action type executed");
        }
    }
}
