use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use protocol::DaemonWsMessage;

pub struct StreamManager {
    buses: RwLock<HashMap<String, broadcast::Sender<DaemonWsMessage>>>,
}

impl StreamManager {
    pub fn new() -> Self {
        Self {
            buses: RwLock::new(HashMap::new()),
        }
    }

    /// Gets a receiver for a server's event bus, spawning worker tasks if necessary.
    pub async fn subscribe(
        self: &Arc<Self>,
        server_id: &str,
        docker: crate::services::docker::DockerManager,
        console_mgr: Arc<crate::services::console::ConsoleStreamManager>,
    ) -> broadcast::Receiver<DaemonWsMessage> {
        let mut buses = self.buses.write().await;
        if let Some(tx) = buses.get(server_id) {
            return tx.subscribe();
        }

        // Create new bus
        let (tx, rx) = broadcast::channel(500);
        buses.insert(server_id.to_string(), tx.clone());
        
        let s_id = server_id.to_string();
        let tx_clone = tx.clone();
        let stream_mgr = self.clone();
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(3));
            
            // Console sub-stream
            let (console_tx, mut console_rx) = broadcast::channel::<String>(100);
            let _ = console_mgr.attach_and_broadcast(&s_id, console_tx).await;
            
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        if tx_clone.receiver_count() == 0 {
                            break;
                        }
                        
                        let c_name = crate::services::docker::DockerManager::container_name(&s_id);
                        if let Ok((cpu, mem_used, mem_limit, net_rx, net_tx)) = docker.get_container_metrics(&c_name).await {
                            let _ = tx_clone.send(DaemonWsMessage::StatsEvent {
                                server_id: s_id.clone(),
                                cpu_percent: cpu,
                                memory_used_mb: mem_used / 1_048_576,
                                memory_total_mb: mem_limit / 1_048_576,
                                network_rx_bytes: net_rx,
                                network_tx_bytes: net_tx,
                            });
                        }
                    }
                    result = console_rx.recv() => {
                        match result {
                            Ok(line) => {
                                if tx_clone.receiver_count() == 0 {
                                    break;
                                }
                                let _ = tx_clone.send(DaemonWsMessage::ConsoleOutput {
                                    server_id: s_id.clone(),
                                    line,
                                });
                            }
                            Err(_) => {
                                // Container probably stopped, keep running for metrics
                            }
                        }
                    }
                }
            }
            
            // Cleanup when all clients disconnected
            let mut buses = stream_mgr.buses.write().await;
            if let Some(current_tx) = buses.get(&s_id) {
                // Double check to avoid race conditions
                if current_tx.receiver_count() == 0 {
                    buses.remove(&s_id);
                }
            }
        });

        rx
    }

    /// Broadcast an event to all connected clients for a specific server
    #[allow(dead_code)]
    pub async fn broadcast(&self, server_id: &str, msg: DaemonWsMessage) {
        if let Some(tx) = self.buses.read().await.get(server_id) {
            let _ = tx.send(msg);
        }
    }
}
