
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis, CartesianGrid, Legend } from 'recharts';
import { Activity, Globe, HardDrive } from 'lucide-react';
import { DataPoint } from '../../store/serverStatsStore';

export function formatBps(bps: number) {
    if (bps >= 1024 * 1024) return (bps / (1024 * 1024)).toFixed(1) + ' MB/s';
    if (bps >= 1024) return (bps / 1024).toFixed(1) + ' KB/s';
    return bps + ' B/s';
}

export function MetricChart({ data, dataKey, color, label, current, unit }: {
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

export function NetworkChart({ data, currentRx, currentTx }: {
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

export function DiskUsageCard({ used, total }: { used: number; total: number }) {
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
