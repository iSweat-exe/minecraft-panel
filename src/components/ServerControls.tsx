import React from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { useConsoleStore } from '../store/consoleStore';

export const ServerControls: React.FC = () => {
    const { serviceStatus, setServiceStatus, mcPing, setMcPing } = useConnectionStore();
    const clearConsole = useConsoleStore((s) => s.clear);

    const fetchStatus = async () => {
        try {
            const [status, ping] = await Promise.all([
                tauriBridge.serviceStatus(),
                tauriBridge.mcPing(),
            ]);
            setServiceStatus(status);
            setMcPing(ping);
        } catch (e) {
            console.error("Failed to fetch status:", e);
        }
    };



    const doAction = async (action: 'start' | 'stop' | 'restart') => {
        try {
            clearConsole();
            await tauriBridge.serviceAction(action);
            setTimeout(fetchStatus, 2000);
        } catch (e) {
            console.error(e);
        }
    };

    const isActive = serviceStatus?.active_state === 'active';
    const isOnline = mcPing?.online ?? false;

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-5">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Server</h2>

            {/* Status rows */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Service</span>
                    <span className={`text-sm font-medium px-2.5 py-0.5 rounded-md ${
                        isActive
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                    }`}>
                        {serviceStatus?.active_state ?? '—'}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Process</span>
                    <span className="text-sm text-zinc-300">
                        {serviceStatus?.sub_state ?? '—'}
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Minecraft</span>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                        <span className="text-sm text-zinc-300">
                            {isOnline ? 'Online' : 'Offline'}
                        </span>
                    </div>
                </div>
                {isOnline && mcPing?.players_online != null && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Players</span>
                        <span className="text-sm text-zinc-300">
                            {mcPing.players_online} / {mcPing.players_max}
                        </span>
                    </div>
                )}
                {isOnline && mcPing?.latency_ms != null && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400">Ping</span>
                        <span className="text-sm text-zinc-300">
                            {mcPing.latency_ms} ms
                        </span>
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-800" />

            {/* Actions */}
            <div className="space-y-2">
                <button
                    onClick={() => doAction('start')}
                    disabled={isActive}
                    className="w-full text-sm font-medium py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                >
                    Start
                </button>
                <button
                    onClick={() => doAction('restart')}
                    disabled={!isActive}
                    className="w-full text-sm font-medium py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-zinc-700"
                >
                    Restart
                </button>
                <button
                    onClick={() => doAction('stop')}
                    disabled={!isActive}
                    className="w-full text-sm font-medium py-2 rounded-md bg-zinc-800 hover:bg-red-600/80 text-zinc-400 hover:text-white border border-zinc-700 hover:border-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-zinc-800 disabled:hover:text-zinc-400 disabled:hover:border-zinc-700"
                >
                    Stop
                </button>
            </div>
        </div>
    );
};
