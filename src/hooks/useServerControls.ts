import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore, PendingAction } from '../store/connectionStore';
import { useConsoleStore } from '../store/consoleStore';
import { logAction } from '../lib/actionLogger';

export const ACTION_LABELS: Record<NonNullable<PendingAction>, string> = {
    starting: 'Démarrage…',
    stopping: 'Arrêt…',
    restarting: 'Redémarrage…',
};

export function useServerControls() {
    const { 
        serviceStatus, setServiceStatus, 
        mcPing, setMcPing, 
        pendingAction, setPendingAction,
        countdownAction, setCountdownAction,
        forceActionCallback, setForceActionCallback
    } = useConnectionStore();
    const clearConsole = useConsoleStore((s) => s.clear);

    const pollUntilSettled = async () => {
        // Poll every 1.5s until the service reaches a settled state
        const maxAttempts = 40; // ~60s max
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, 1500));
            try {
                const [status, ping] = await Promise.all([
                    tauriBridge.serviceStatus(),
                    tauriBridge.mcPing(),
                ]);
                setServiceStatus(status);
                setMcPing(ping);

                // "activating" / "deactivating" / "reloading" are transient systemd states
                const settled = !['activating', 'deactivating', 'reloading'].includes(status.active_state);
                if (settled) break;
            } catch {
                // Connection issues during restart are expected, keep polling
            }
        }
        setPendingAction(null);
    };

    const doAction = async (action: 'start' | 'stop' | 'restart') => {
        const pendingMap: Record<string, PendingAction> = {
            start: 'starting',
            stop: 'stopping',
            restart: 'restarting',
        };
        setPendingAction(pendingMap[action]);
        
        let forced = false;
        try {
            if (action === 'stop' || action === 'restart') {
                const actionFr = action === 'stop' ? "s'arrêter" : 'redémarrer';
                await tauriBridge.consoleSendCommand(`/say Le serveur va ${actionFr} dans 60 secondes...`).catch(() => {});
                
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

                if (forced) {
                    if (action === 'restart') {
                        await tauriBridge.consoleSendCommand(`/say Redemarrage...`).catch(() => {});
                        await new Promise(r => setTimeout(r, 3000));
                    } else if (action === 'stop') {
                        await tauriBridge.consoleSendCommand(`/say Arret du serveur`).catch(() => {});
                        await new Promise(r => setTimeout(r, 5000));
                    }
                }
            }

            clearConsole();
            await tauriBridge.serviceAction(action);
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

    const isActive = serviceStatus?.active_state === 'active';
    const isOnline = mcPing?.online ?? false;
    const isBusy = pendingAction !== null;

    return {
        serviceStatus,
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
