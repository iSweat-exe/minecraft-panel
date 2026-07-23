import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore, PendingAction } from '../store/connectionStore';
import { useConsoleStore } from '../store/consoleStore';
import { logAction } from '../lib/actionLogger';
import { useState, useEffect } from 'react';

export const ACTION_LABELS: Record<NonNullable<PendingAction>, string> = {
    starting: 'Démarrage…',
    stopping: 'Arrêt…',
    restarting: 'Redémarrage…',
};

// We need a fixed server ID since the panel currently assumes a single server.
// In the future, this could be dynamic if we support multiple servers per daemon.
const DEFAULT_SERVER_ID = "default";

export function useServerControls() {
    const { 
        serviceStatus, 
        mcPing, setMcPing, 
        pendingAction, setPendingAction,
        countdownAction, setCountdownAction,
        forceActionCallback, setForceActionCallback
    } = useConnectionStore();
    const clearConsole = useConsoleStore((s) => s.clear);

    // New state to track daemon server status specifically
    const [serverState, setServerState] = useState<string>('unknown');

    const pollUntilSettled = async () => {
        const host = localStorage.getItem('node_host');
        const port = localStorage.getItem('node_port') || '8080';
        const token = localStorage.getItem('node_token');
        if (!host || !token) return;
        const nodeUrl = `http://${host}:${port}`;

        const maxAttempts = 40; // ~60s max
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, 1500));
            try {
                const [servers, ping] = await Promise.all([
                    tauriBridge.nodeListServers(nodeUrl, token).catch(() => []),
                    tauriBridge.nodeGetServerPing(nodeUrl, token, DEFAULT_SERVER_ID).catch(() => null),
                ]);
                
                const srv = servers.find(s => s.server_id === DEFAULT_SERVER_ID);
                const srvState = srv ? srv.state : 'stopped';
                
                setServerState(srvState);
                if (ping) {
                    setMcPing({
                        online: true,
                        players_online: ping.online_players,
                        players_max: ping.max_players,
                        latency_ms: 0,
                        sample: ping.sample || []
                    });
                } else {
                    setMcPing({ online: false, players_online: null, players_max: null, latency_ms: null, sample: [] });
                }

                // Container states: created, running, paused, restarting, removing, exited, dead
                const settled = ['running', 'exited', 'dead'].includes(srvState);
                if (settled) break;
            } catch {
                // Keep polling
            }
        }
        setPendingAction(null);
    };

    // Auto-poll status
    useEffect(() => {
        let isMounted = true;
        
        const fetchStatus = async () => {
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            if (!host || !token) return;
            const nodeUrl = `http://${host}:${port}`;
            
            try {
                const [servers, ping] = await Promise.all([
                    tauriBridge.nodeListServers(nodeUrl, token).catch(() => []),
                    tauriBridge.nodeGetServerPing(nodeUrl, token, DEFAULT_SERVER_ID).catch(() => null),
                ]);
                const srv = servers.find(s => s.server_id === DEFAULT_SERVER_ID);
                if (isMounted) {
                    if (srv) {
                        setServerState(srv.state);
                    }
                    if (ping) {
                        setMcPing({
                            online: true,
                            players_online: ping.online_players,
                            players_max: ping.max_players,
                            latency_ms: 0,
                            sample: ping.sample || []
                        });
                    } else {
                        setMcPing({ online: false, players_online: null, players_max: null, latency_ms: null, sample: [] });
                    }
                }
            } catch (err) {
                // Ignore
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const doAction = async (action: 'start' | 'stop' | 'restart') => {
        const pendingMap: Record<string, PendingAction> = {
            start: 'starting',
            stop: 'stopping',
            restart: 'restarting',
        };
        setPendingAction(pendingMap[action]);
        
        const host = localStorage.getItem('node_host');
        const port = localStorage.getItem('node_port') || '8080';
        const token = localStorage.getItem('node_token');
        if (!host || !token) {
            setPendingAction(null);
            return;
        }
        const nodeUrl = `http://${host}:${port}`;

        let forced = false;
        try {
            if ((action === 'stop' || action === 'restart') && isOnline) {
                // Wait, if we use Daemon, we send commands via WS or we implement a sendCommand endpoint.
                // The Panel still expects `tauriBridge.consoleSendCommand()`. If that doesn't work, this fails silently.
                
                setCountdownAction(action);
                
                let timeoutId: any;
                const waitPromise = new Promise<boolean>(resolve => {
                    const forceResolve = () => {
                        clearTimeout(timeoutId);
                        resolve(true);
                    };
                    setForceActionCallback(forceResolve);
                    
                    timeoutId = setTimeout(() => {
                        resolve(false);
                    }, 60000);
                });
                
                forced = await waitPromise;
                
                setCountdownAction(null);
                setForceActionCallback(null);
            }

            clearConsole();
            
            // Execute the action using Node Power Action
            const powerActionMap: Record<string, "start" | "stop" | "restart" | "kill"> = {
                start: "start",
                stop: forced ? "kill" : "stop",
                restart: "restart"
            };
            
            await tauriBridge.nodePowerAction(nodeUrl, token, DEFAULT_SERVER_ID, powerActionMap[action] as any);
            
            logAction(
                action === 'start' ? 'Démarrage du serveur' : action === 'stop' ? 'Arrêt du serveur' : 'Redémarrage du serveur',
                { forced }
            );
        } catch (e) {
            console.error(e);
            setPendingAction(null);
            return;
        }

        pollUntilSettled();
    };

    const isOnline = mcPing?.online ?? false;
    const isActive = serverState === 'running' || isOnline;
    const isBusy = pendingAction !== null;

    return {
        serviceStatus, // Can be removed eventually
        serverState,
        mcPing,
        pendingAction,
        countdownAction,
        forceActionCallback,
        doAction,
        isActive,
        isOnline,
        isBusy
    };
}

