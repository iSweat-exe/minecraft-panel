use sqlx::SqlitePool;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{error, info};

pub async fn start_scheduler(db: SqlitePool) -> anyhow::Result<JobScheduler> {
    let sched = JobScheduler::new().await?;

    // Load existing automations from DB
    #[derive(sqlx::FromRow)]
    struct DbAutomation {
        name: String,
        cron_expr: String,
        action_type: String,
    }

    let automations =
        sqlx::query_as::<_, DbAutomation>("SELECT name, cron_expr, action_type FROM automations")
            .fetch_all(&db)
            .await?;

    for auto in automations {
        let name = auto.name.clone();
        let action_type = auto.action_type.clone();

        let job = Job::new_async(auto.cron_expr.as_str(), move |_uuid, _l| {
            let name = name.clone();
            let action_type = action_type.clone();
            Box::pin(async move {
                info!("Running automation job: {} (Type: {})", name, action_type);
            })
        });

        match job {
            Ok(j) => {
                sched.add(j).await?;
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
