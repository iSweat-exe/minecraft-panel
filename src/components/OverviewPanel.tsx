import React, { useEffect, useState, useCallback } from 'react';
import { tauriBridge, SystemMetrics } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis, CartesianGrid, Legend } from 'recharts';
import { HardDrive, Server, Users, Activity, Globe } from 'lucide-react';
import { ServerControls } from './ServerControls';

const MAX_HISTORY = 120; // 60 seconds history

interface DataPoint {
    time: string;
    cpu: number;
    ram: number;
    rx: number;
    tx: number;
}

function formatBps(bps: number) {
    if (bps >= 1024 * 1024) return (bps / (1024 * 1024)).toFixed(1) + ' MB/s';
    if (bps >= 1024) return (bps / 1024).toFixed(1) + ' KB/s';
    return bps + ' B/s';
}

function MetricChart({ data, dataKey, color, label, current, unit }: {
    data: DataPoint[];
    dataKey: 'cpu' | 'ram';
    color: string;
    label: string;
    current: string;
    unit: string;
}) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Activity size={16} className="text-zinc-500" />
                    <h3 className="text-sm font-semibold text-zinc-200 tracking-wide">{label}</h3>
                </div>
                <div className="text-right">
                    <span className="text-xl font-mono text-zinc-100">{current}</span>
                    <span className="text-zinc-500 text-sm ml-1">{unit}</span>
                </div>
            </div>
            <div className="w-full h-36">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.3}/>
                                <stop offset="100%" stopColor={color} stopOpacity={0.0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#27272a" />
                        <YAxis domain={[0, 100]} hide />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: '#18181b', 
                                border: '1px solid #27272a', 
                                borderRadius: '0.5rem', 
                                color: '#e4e4e7', 
                                fontSize: '12px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
                            }}
                            itemStyle={{ color: color, fontWeight: 500 }}
                            labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                            formatter={(value: any) => [`${Number(value).toFixed(1)}%`, label]}
                            isAnimationActive={false}
                        />
                        <Legend 
                            verticalAlign="top" 
                            height={30} 
                            iconType="circle" 
                            iconSize={8}
                            wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }}
                        />
                        <Area 
                            name={label}
                            type="monotone" 
                            dataKey={dataKey} 
                            stroke={color} 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill={`url(#color-${dataKey})`} 
                            isAnimationActive={false}
                            activeDot={{ r: 4, strokeWidth: 0, fill: color }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function NetworkChart({ data, currentRx, currentTx }: {
    data: DataPoint[];
    currentRx: number;
    currentTx: number;
}) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Globe size={16} className="text-zinc-500" />
                    <h3 className="text-sm font-semibold text-zinc-200 tracking-wide">Network</h3>
                </div>
                <div className="flex gap-4 text-right">
                    <div>
                        <span className="text-xs text-zinc-500 uppercase font-semibold mr-2">TX</span>
                        <span className="text-lg font-mono text-zinc-100">{formatBps(currentTx)}</span>
                    </div>
                    <div>
                        <span className="text-xs text-zinc-500 uppercase font-semibold mr-2">RX</span>
                        <span className="text-lg font-mono text-zinc-100">{formatBps(currentRx)}</span>
                    </div>
                </div>
            </div>
            <div className="w-full h-36">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="color-rx" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0}/>
                            </linearGradient>
                            <linearGradient id="color-tx" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ec4899" stopOpacity={0.3}/>
                                <stop offset="100%" stopColor="#ec4899" stopOpacity={0.0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#27272a" />
                        <YAxis hide />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: '#18181b', 
                                border: '1px solid #27272a', 
                                borderRadius: '0.5rem', 
                                color: '#e4e4e7', 
                                fontSize: '12px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
                            }}
                            labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                            formatter={(value: any, name: any) => [formatBps(Number(value)), name === 'rx' ? 'RX (Down)' : 'TX (Up)']}
                            isAnimationActive={false}
                        />
                        <Legend 
                            verticalAlign="top" 
                            height={30} 
                            iconType="circle" 
                            iconSize={8}
                            wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }}
                            {...({ payload: [
                                { value: 'TX (Up)', type: 'circle', color: '#ec4899' },
                                { value: 'RX (Down)', type: 'circle', color: '#3b82f6' }
                            ] } as any)}
                        />
                        <Area 
                            name="tx"
                            type="monotone" 
                            dataKey="tx" 
                            stroke="#ec4899" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#color-tx)" 
                            isAnimationActive={false}
                            activeDot={{ r: 4, strokeWidth: 0, fill: '#ec4899' }}
                        />
                        <Area 
                            name="rx"
                            type="monotone" 
                            dataKey="rx" 
                            stroke="#3b82f6" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#color-rx)" 
                            isAnimationActive={false}
                            activeDot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function DiskUsage({ used, total }: { used: number; total: number }) {
    const pct = total > 0 ? (used / total) * 100 : 0;
    const free = total - used;
    
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col gap-5">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <HardDrive className="text-amber-500" size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-zinc-200">Storage</h3>
                    <p className="text-xs text-zinc-500">Main Disk Mount (/minecraft)</p>
                </div>
            </div>
            
            <div className="space-y-2.5">
                <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Used: <span className="text-zinc-200 font-mono ml-1">{used.toFixed(1)} GB</span></span>
                    <span className="text-zinc-400">Free: <span className="text-zinc-200 font-mono ml-1">{free.toFixed(1)} GB</span></span>
                </div>
                
                <div className="h-4 bg-zinc-950 rounded-full overflow-hidden shadow-inner border border-zinc-800/50">
                    <div
                        className="h-full rounded-full transition-[width] duration-1000 ease-out relative"
                        style={{ width: `${pct}%`, backgroundColor: '#f59e0b' }}
                    >
                        {/* Subtle highlight inside the progress bar */}
                        <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/10 rounded-t-full" />
                    </div>
                </div>
                
                <div className="flex justify-between items-center text-xs">
                    <span className="text-amber-500 font-medium">{pct.toFixed(1)}% full</span>
                    <span className="text-zinc-500 font-mono">{total.toFixed(1)} GB Total</span>
                </div>
            </div>
        </div>
    );
}

export const OverviewPanel: React.FC = () => {
    const { mcPing, pendingAction } = useConnectionStore();
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
    const [history, setHistory] = useState<DataPoint[]>(() => 
        Array.from({ length: MAX_HISTORY }).map(() => ({ time: '', cpu: 0, ram: 0, rx: 0, tx: 0 }))
    );

    const handleMetrics = useCallback((m: SystemMetrics) => {
        setMetrics(m);
        
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        setHistory(prev => {
            const ramPct = m.ram_total_mb > 0 ? (m.ram_used_mb / m.ram_total_mb) * 100 : 0;
            const newPoint = { time: timeStr, cpu: m.cpu_percent, ram: ramPct, rx: m.network_rx_bps, tx: m.network_tx_bps };
            const next = [...prev, newPoint];
            return next.slice(-MAX_HISTORY);
        });
    }, []);

    useEffect(() => {
        // Subscribe to streaming metrics (opens a persistent SSH channel)
        tauriBridge.metricsSubscribe().catch(e => console.error('Failed to subscribe to metrics:', e));

        // Listen for metric events pushed from the backend
        const unlistenPromise = tauriBridge.onMetricsUpdate(handleMetrics);

        return () => {
            unlistenPromise.then(unlisten => unlisten());
        };
    }, [handleMetrics]);

    const isOnline = mcPing?.online ?? false;

    const getStatusIndicator = () => {
        if (pendingAction) {
            const labels: Record<string, string> = {
                starting: 'Démarrage…',
                stopping: 'Arrêt…',
                restarting: 'Redémarrage…',
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
                        <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Minecraft Server</h2>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <NetworkChart 
                            data={history} 
                            currentRx={metrics?.network_rx_bps ?? 0} 
                            currentTx={metrics?.network_tx_bps ?? 0} 
                        />
                        <DiskUsage 
                            used={metrics?.disk_used_gb ?? 0} 
                            total={metrics?.disk_total_gb ?? 0} 
                        />
                    </div>
                </div>
                
                <div className="lg:col-span-1">
                    <ServerControls />
                </div>
            </div>
        </div>
    );
};
