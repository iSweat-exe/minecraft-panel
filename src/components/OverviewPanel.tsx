import React, { useState, useMemo } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { useServerStats } from '../hooks/useServerStats';
import { useServerStatsStore } from '../store/serverStatsStore';
import { Server, Users, Activity, Clock } from 'lucide-react';
import { ServerControls } from './ServerControls';
import { MetricChart, NetworkChart, DiskUsageCard } from './overview/ResourceCharts';

type TimeRange = '1m' | '5m' | '15m' | '1h' | '1d';

export const OverviewPanel: React.FC = () => {
    const { mcPing, pendingAction, host } = useConnectionStore();
    const { metrics } = useServerStats();
    const { rawPoints, hourPoints, dayPoints } = useServerStatsStore();
    
    const [timeRange, setTimeRange] = useState<TimeRange>('5m');

    const history = useMemo(() => {
        switch (timeRange) {
            case '1m': return rawPoints.slice(-60);
            case '5m': return rawPoints.slice(-300);
            case '15m': return rawPoints;
            case '1h': return hourPoints;
            case '1d': return dayPoints;
            default: return rawPoints.slice(-300);
        }
    }, [timeRange, rawPoints, hourPoints, dayPoints]);

    const isOnline = mcPing?.online ?? false;

    const getStatusIndicator = () => {
        if (pendingAction) {
            const labels: Record<string, string> = {
                'starting': 'Démarrage...',
                'stopping': 'Arrêt...',
                'restarting': 'Redémarrage...'
            };
            return (
                <>
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    <span className="text-sm text-amber-400 font-medium">{labels[pendingAction]}</span>
                </>
            );
        }
        return (
            <>
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                <span className="text-sm text-zinc-400 font-medium">
                    {isOnline ? 'En ligne' : 'Hors ligne'}
                </span>
            </>
        );
    };

    return (
        <div className="h-full overflow-y-auto p-6 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <Server className="text-indigo-500" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-zinc-100 tracking-tight">{host || 'Minecraft Server'}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            {getStatusIndicator()}
                        </div>
                    </div>
                </div>

                <div className="flex gap-8">
                    <div className="flex flex-col items-end justify-center">
                        <div className="flex items-center gap-2 text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">
                            <Users size={14} /> Players
                        </div>
                        <div className="text-2xl font-mono text-zinc-200">
                            {mcPing?.players_online ?? 0} <span className="text-zinc-600 text-lg">/ {mcPing?.players_max ?? 0}</span>
                        </div>
                    </div>
                    <div className="w-px h-12 bg-zinc-800" />
                    <div className="flex flex-col items-end justify-center">
                        <div className="flex items-center gap-2 text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">
                            <Activity size={14} /> Latency
                        </div>
                        <div className="text-2xl font-mono text-zinc-200">
                            {mcPing?.latency_ms ?? 0} <span className="text-zinc-600 text-lg">ms</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-zinc-500" />
                <span className="text-sm font-medium text-zinc-400 mr-2">Période:</span>
                {(['1m', '5m', '15m', '1h', '1d'] as TimeRange[]).map((range) => (
                    <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            timeRange === range 
                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                            : 'bg-zinc-800/50 text-zinc-400 border border-transparent hover:bg-zinc-800 hover:text-zinc-300'
                        }`}
                    >
                        {range}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <MetricChart 
                    data={history} 
                    dataKey="cpu" 
                    color="#10b981" 
                    label="CPU Usage" 
                    current={metrics ? metrics.cpu_percent.toFixed(1) : "0.0"} 
                    unit="%" 
                />
                <MetricChart 
                    data={history} 
                    dataKey="ram" 
                    color="#10b981" 
                    label="Memory Usage" 
                    current={metrics ? metrics.ram_used_mb.toString() : "0"} 
                    unit="MB" 
                />
                <ServerControls />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <NetworkChart 
                    data={history} 
                    currentRx={metrics?.network_rx_bps ?? 0} 
                    currentTx={metrics?.network_tx_bps ?? 0} 
                />
                <DiskUsageCard 
                    used={metrics?.disk_used_gb ?? 0} 
                    total={metrics?.disk_total_gb ?? 0} 
                />
            </div>
        </div>
    );
};
