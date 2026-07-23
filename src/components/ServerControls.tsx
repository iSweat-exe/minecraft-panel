import React from 'react';
import { Users, Signal, Server } from 'lucide-react';
import { useServerControls, ACTION_LABELS } from '../hooks/useServerControls';
import { usePermissionStore } from '../store/permissionStore';
import { Spinner } from './ui/Spinner';
import { Button } from './ui/Button';

export const ServerControls: React.FC = () => {
    const {
        mcPing,
        pendingAction,
        countdownAction,
        forceActionCallback,
        doAction,
        isActive,
        isOnline,
        isBusy
    } = useServerControls();
    const can = usePermissionStore(state => state.can);

    // Determine the main status
    const getStatusInfo = () => {
        if (pendingAction) {
            return {
                label: ACTION_LABELS[pendingAction],
                color: 'text-amber-400',
                bg: 'bg-amber-500/15',
                border: 'border-amber-500/20',
                isSpinning: true
            };
        }
        if (isOnline) {
            return {
                label: 'En ligne',
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/15',
                border: 'border-emerald-500/20',
                isSpinning: false
            };
        }
        if (isActive) {
            return {
                label: 'Démarrage...',
                color: 'text-blue-400',
                bg: 'bg-blue-500/15',
                border: 'border-blue-500/20',
                isSpinning: true
            };
        }
        return {
            label: 'Hors ligne',
            color: 'text-red-400',
            bg: 'bg-red-500/15',
            border: 'border-red-500/20',
            isSpinning: false
        };
    };

    const status = getStatusInfo();

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col h-full justify-between">
            <div>
                {/* Header & Status */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Server size={18} className="text-zinc-400" />
                        <h2 className="text-sm font-bold text-zinc-100 tracking-wide uppercase">Server</h2>
                    </div>
                    
                    <div className={`flex items-center gap-1.5 ${status.color}`}>
                        {status.isSpinning ? (
                            <Spinner size={14} />
                        ) : (
                            <div className={`w-2 h-2 rounded-full ${status.color.replace('text-', 'bg-')}`} />
                        )}
                        <span className="text-xs font-bold uppercase">{status.label}</span>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-3.5 flex flex-col items-center justify-center">
                        <div className="flex items-center gap-1.5 text-zinc-500 mb-1.5">
                            <Users size={14} />
                            <span className="text-[10px] uppercase tracking-widest font-bold">Players</span>
                        </div>
                        <span className="text-xl font-bold text-zinc-100 tracking-tight">
                            {isOnline ? `${mcPing?.players_online ?? 0} / ${mcPing?.players_max ?? 0}` : '—'}
                        </span>
                    </div>
                    <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-3.5 flex flex-col items-center justify-center">
                        <div className="flex items-center gap-1.5 text-zinc-500 mb-1.5">
                            <Signal size={14} />
                            <span className="text-[10px] uppercase tracking-widest font-bold">Ping</span>
                        </div>
                        <span className="text-xl font-bold text-zinc-100 tracking-tight">
                            {isOnline && mcPing?.latency_ms != null ? `${mcPing.latency_ms} ms` : '—'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-3 gap-2">
                <Button
                    onClick={() => doAction('start')}
                    disabled={isBusy || isActive || !can('control.start')}
                    variant="ghost"
                    className="group flex flex-col items-center justify-center gap-2 py-3.5 h-auto bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 rounded-lg transition-all"
                >
                    <span className={`w-2 h-2 rounded-full transition-colors ${isActive ? 'bg-emerald-500/30' : 'bg-emerald-500'}`}></span>
                    <span className="text-xs font-semibold text-zinc-400 group-hover:text-zinc-200 transition-colors">Start</span>
                </Button>
                <Button
                    onClick={() => {
                        if (countdownAction === 'restart') {
                            forceActionCallback?.();
                        } else {
                            doAction('restart');
                        }
                    }}
                    disabled={(isBusy && countdownAction !== 'restart') || (!isActive && !isOnline) || !can('control.restart')}
                    variant="ghost"
                    className={`group flex flex-col items-center justify-center gap-2 py-3.5 h-auto bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border ${countdownAction === 'restart' ? 'border-amber-500/50' : 'border-zinc-800'} rounded-lg transition-all`}
                >
                    <span className={`w-2 h-2 rounded-full transition-colors ${countdownAction === 'restart' ? 'bg-amber-500 animate-pulse' : (!isActive && !isOnline) ? 'bg-amber-500/30' : 'bg-amber-500'}`}></span>
                    <span className={`text-xs font-semibold transition-colors ${countdownAction === 'restart' ? 'text-amber-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}>{countdownAction === 'restart' ? 'Force Restart' : 'Restart'}</span>
                </Button>
                <Button
                    onClick={() => {
                        if (countdownAction === 'stop') {
                            forceActionCallback?.();
                        } else {
                            doAction('stop');
                        }
                    }}
                    disabled={(isBusy && countdownAction !== 'stop') || !isActive || !can('control.stop')}
                    variant="ghost"
                    className={`group flex flex-col items-center justify-center gap-2 py-3.5 h-auto bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 border ${countdownAction === 'stop' ? 'border-red-500/50' : 'border-zinc-800'} rounded-lg transition-all`}
                >
                    <span className={`w-2 h-2 rounded-full transition-colors ${countdownAction === 'stop' ? 'bg-red-500 animate-pulse' : !isActive ? 'bg-red-500/30' : 'bg-red-500'}`}></span>
                    <span className={`text-xs font-semibold transition-colors ${countdownAction === 'stop' ? 'text-red-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}>{countdownAction === 'stop' ? 'Force Stop' : 'Stop'}</span>
                </Button>
            </div>
        </div>
    );
};
