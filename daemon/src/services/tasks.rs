use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

#[derive(Clone, Debug, serde::Serialize)]
#[serde(tag = "status", content = "message")]
pub enum TaskStatus {
    Running,
    Completed,
    Failed(String),
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(tag = "event", content = "data")]
pub enum TaskEvent {
    Log(String),
    Status(TaskStatus),
}

#[allow(dead_code)]
pub struct Task {
    pub id: Uuid,
    pub server_id: String,
    pub name: String,
    pub status: TaskStatus,
    pub tx: broadcast::Sender<TaskEvent>,
}

pub struct TaskManager {
    tasks: RwLock<HashMap<Uuid, Arc<RwLock<Task>>>>,
}

impl TaskManager {
    pub fn new() -> Self {
        Self {
            tasks: RwLock::new(HashMap::new()),
        }
    }

    pub async fn create_task(
        &self,
        server_id: String,
        name: String,
    ) -> (Uuid, broadcast::Receiver<TaskEvent>) {
        let id = Uuid::new_v4();
        let (tx, rx) = broadcast::channel(100);
        let task = Arc::new(RwLock::new(Task {
            id,
            server_id,
            name,
            status: TaskStatus::Running,
            tx,
        }));

        self.tasks.write().await.insert(id, task);
        (id, rx)
    }

    pub async fn get_task(&self, id: &Uuid) -> Option<Arc<RwLock<Task>>> {
        self.tasks.read().await.get(id).cloned()
    }

    pub async fn update_status(&self, id: &Uuid, status: TaskStatus) {
        if let Some(task) = self.get_task(id).await {
            let mut t = task.write().await;
            t.status = status.clone();
            let _ = t.tx.send(TaskEvent::Status(status));
        }
    }

    pub async fn send_log(&self, id: &Uuid, log: String) {
        if let Some(task) = self.get_task(id).await {
            let t = task.read().await;
            let _ = t.tx.send(TaskEvent::Log(log));
        }
    }
}
