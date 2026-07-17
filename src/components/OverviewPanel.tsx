import React, { useEffect, useState, useCallback } from 'react';
import { tauriBridge, SystemMetrics } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis, CartesianGrid, Legend } from 'recharts';
import { HardDrive, Server, Users, Activity } from 'lucide-react';

const MAX_HISTORY = 60; // 60 seconds history

interface DataPoint {
    time: string;
    cpu: number;
    ram: number;
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
    const { mcPing } = useConnectionStore();
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
    const [history, setHistory] = useState<DataPoint[]>([]);

    const fetchMetrics = useCallback(async () => {
        try {
            const m = await tauriBridge.systemMetrics();
            setMetrics(m);
            
            const now = new Date();
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
            
            setHistory(prev => {
                const ramPct = m.ram_total_mb > 0 ? (m.ram_used_mb / m.ram_total_mb) * 100 : 0;
                const newPoint = { time: timeStr, cpu: m.cpu_percent, ram: ramPct };
                return [...prev.slice(-(MAX_HISTORY - 1)), newPoint];
            });
        } catch (e) {
            console.error('Failed to fetch metrics:', e);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 1000);
        return () => clearInterval(interval);
    }, [fetchMetrics]);

    const isOnline = mcPing?.online ?? false;

    return (
        <div className="h-full overflow-y-auto p-2 space-y-6">
            {/* Server Status Header */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 shadow-inner relative">
                        <Server size={24} className={isOnline ? "text-emerald-400" : "text-zinc-600"} />
                        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-zinc-900 ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">
                            {isOnline ? 'Minecraft Server' : 'Server Offline'}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                                {isOnline ? 'Running smoothly' : 'Service is currently stopped'}
                            </div>
                        </div>
                    </div>
                </div>

                {isOnline && mcPing && (
                    <div className="flex gap-6 border-l border-zinc-800 pl-6">
                        <div>
                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1 font-medium">
                                <Users size={14} />
                                PLAYERS
                            </div>
                            <div className="text-lg font-mono text-zinc-200">
                                {mcPing.players_online ?? 0} <span className="text-zinc-600 text-sm">/ {mcPing.players_max ?? 0}</span>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1 font-medium">
                                <Activity size={14} />
                                LATENCY
                            </div>
                            <div className="text-lg font-mono text-zinc-200">
                                {mcPing.latency_ms ?? '—'} <span className="text-zinc-600 text-sm">ms</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Metric Graphs */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <MetricChart
                    data={history}
                    dataKey="cpu"
                    color="#6366f1"
                    label="CPU Usage"
                    current={metrics?.cpu_percent.toFixed(1) ?? '—'}
                    unit="%"
                />
                <MetricChart
                    data={history}
                    dataKey="ram"
                    color="#10b981"
                    label="Memory Usage"
                    current={metrics ? `${metrics.ram_used_mb}` : '—'}
                    unit={metrics ? `/ ${metrics.ram_total_mb} MB` : 'MB'}
                />
            </div>

            {/* Storage Info */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {metrics && (
                    <DiskUsage
                        used={metrics.disk_used_gb}
                        total={metrics.disk_total_gb}
                    />
                )}
            </div>
        </div>
    );
};
