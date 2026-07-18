import React from 'react';
import { Loader2, Users, Signal } from 'lucide-react';
import { useServerControls, ACTION_LABELS } from '../hooks/useServerControls';

export const ServerControls: React.FC = () => {
    const {
        mcPing,
        pendingAction,
        doAction,
        isActive,
        isOnline,
        isBusy
    } = useServerControls();

    // Determine the main status
    const getStatusInfo = () => {
        if (pendingAction) {
            return {
                label: ACTION_LABELS[pendingAction],
                color: 'text-amber-400',
                bg: 'bg-amber-500/15',
                isSpinning: true
            };
        }
        if (isOnline) {
            return {
                label: 'En ligne',
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/15',
                isSpinning: false
            };
        }
        if (isActive) {
            return {
                label: 'Démarrage en cours...',
                color: 'text-blue-400',
                bg: 'bg-blue-500/15',
                isSpinning: true
            };
        }
        return {
            label: 'Hors ligne',
            color: 'text-red-400',
            bg: 'bg-red-500/15',
            isSpinning: false
        };
    };

    const status = getStatusInfo();

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex flex-col h-full">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Server</h2>

            {/* Main Status */}
            <div className="flex-1 flex flex-col items-center justify-center py-6">
                <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${status.bg} ${status.color}`}>
                    {status.isSpinning ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <div className={`w-2 h-2 rounded-full ${status.color.replace('text-', 'bg-')}`} />
                    )}
                    <span className="font-semibold">{status.label}</span>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-3 flex flex-col items-center justify-center">
                    <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                        <Users size={14} />
                        <span className="text-xs uppercase tracking-wider font-medium">Players</span>
                    </div>
                    <span className="text-lg font-semibold text-zinc-200">
                        {isOnline ? `${mcPing?.players_online ?? 0} / ${mcPing?.players_max ?? 0}` : '—'}
                    </span>
                </div>
                <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-3 flex flex-col items-center justify-center">
                    <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                        <Signal size={14} />
                        <span className="text-xs uppercase tracking-wider font-medium">Ping</span>
                    </div>
                    <span className="text-lg font-semibold text-zinc-200">
                        {isOnline && mcPing?.latency_ms != null ? `${mcPing.latency_ms} ms` : '—'}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-3 gap-2">
                <button
                    onClick={() => doAction('start')}
                    disabled={isBusy || isActive}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 disabled:hover:bg-zinc-950 border border-zinc-800 rounded-lg transition-all group"
                >
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500/30' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] group-hover:shadow-[0_0_12px_rgba(16,185,129,0.6)]'}`}></span>
                    <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-300">Start</span>
                </button>
                <button
                    onClick={() => doAction('restart')}
                    disabled={isBusy || (!isActive && !isOnline)}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 disabled:hover:bg-zinc-950 border border-zinc-800 rounded-lg transition-all group"
                >
                    <span className={`w-2 h-2 rounded-full ${(!isActive && !isOnline) ? 'bg-amber-500/30' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)] group-hover:shadow-[0_0_12px_rgba(245,158,11,0.6)]'}`}></span>
                    <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-300">Restart</span>
                </button>
                <button
                    onClick={() => doAction('stop')}
                    disabled={isBusy || !isActive}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 disabled:hover:bg-zinc-950 border border-zinc-800 rounded-lg transition-all group"
                >
                    <span className={`w-2 h-2 rounded-full ${!isActive ? 'bg-red-500/30' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)] group-hover:shadow-[0_0_12px_rgba(239,68,68,0.6)]'}`}></span>
                    <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-300">Stop</span>
                </button>
            </div>
        </div>
    );
};
