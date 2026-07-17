import React, { useEffect, useState, useCallback } from 'react';
import { tauriBridge, SystemMetrics } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

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
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-baseline justify-between mb-3">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
                <span className="text-sm font-mono text-zinc-200">{current}<span className="text-zinc-500 text-xs ml-1">{unit}</span></span>
            </div>
            <div className="w-full h-24">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={color} stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <YAxis domain={[0, 100]} hide />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '0.5rem', color: '#e4e4e7', fontSize: '12px' }}
                            itemStyle={{ color: color }}
                            labelStyle={{ display: 'none' }}
                            formatter={(value: any) => [`${Number(value).toFixed(1)}%`, label]}
                            isAnimationActive={false}
                        />
                        <Area 
                            type="monotone" 
                            dataKey={dataKey} 
                            stroke={color} 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill={`url(#color-${dataKey})`} 
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function UsageBar({ label, used, total, unit, color }: {
    label: string;
    used: number;
    total: number;
    unit: string;
    color: string;
}) {
    const pct = total > 0 ? (used / total) * 100 : 0;
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
                <span className="text-sm font-mono text-zinc-200">
                    {used}<span className="text-zinc-500 text-xs">/{total} {unit}</span>
                </span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                />
            </div>
            <div className="text-right mt-1">
                <span className="text-xs text-zinc-600">{pct.toFixed(1)}%</span>
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
        // Update more frequently for a fluid, live feel
        const interval = setInterval(fetchMetrics, 1000);
        return () => clearInterval(interval);
    }, [fetchMetrics]);

    const isOnline = mcPing?.online ?? false;

    return (
        <div className="h-full overflow-y-auto space-y-4">
            {/* Server status bar */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center gap-4">
                <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-zinc-600'}`} />
                <div>
                    <div className="text-sm text-zinc-200 font-medium">
                        {isOnline ? 'Server Online' : 'Server Offline'}
                    </div>
                    {isOnline && mcPing && (
                        <div className="text-xs text-zinc-500">
                            {mcPing.players_online ?? 0}/{mcPing.players_max ?? 0} players
                            {mcPing.latency_ms != null && ` · ${mcPing.latency_ms}ms`}
                        </div>
                    )}
                </div>
            </div>

            {/* Graphs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MetricChart
                    data={history}
                    dataKey="cpu"
                    color="#6366f1"
                    label="CPU"
                    current={metrics?.cpu_percent.toFixed(1) ?? '—'}
                    unit="%"
                />
                <MetricChart
                    data={history}
                    dataKey="ram"
                    color="#22c55e"
                    label="Memory"
                    current={metrics ? `${metrics.ram_used_mb}` : '—'}
                    unit={metrics ? `/ ${metrics.ram_total_mb} MB` : 'MB'}
                />
            </div>

            {/* Disk */}
            {metrics && (
                <UsageBar
                    label="Disk"
                    used={metrics.disk_used_gb}
                    total={metrics.disk_total_gb}
                    unit="GB"
                    color="#f59e0b"
                />
            )}
        </div>
    );
};
