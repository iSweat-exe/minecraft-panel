
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis, CartesianGrid, Legend } from 'recharts';
import { Activity, Globe, HardDrive } from 'lucide-react';
import { DataPoint } from '../../store/serverStatsStore';
import { Card, CardContent } from '../ui/Card';

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
        <Card>
            <CardContent className="p-5">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Activity size={16} className="text-muted-foreground" />
                        <h3 className="text-sm font-semibold text-foreground tracking-wide">{label}</h3>
                    </div>
                <div className="text-right">
                    <span className="text-xl font-mono text-foreground">{current}</span>
                    <span className="text-muted-foreground text-sm ml-1">{unit}</span>
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
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--color-border)" />
                        <YAxis domain={[0, 100]} hide />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'var(--color-surface)', 
                                border: '1px solid var(--color-border)', 
                                borderRadius: '0.5rem', 
                                color: 'var(--color-foreground)', 
                                fontSize: '12px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
                            }}
                            itemStyle={{ color: color, fontWeight: 500 }}
                            labelStyle={{ color: 'var(--color-muted-foreground)', marginBottom: '4px' }}
                            formatter={(value: any) => [`${Number(value).toFixed(1)}%`, label]}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.time || ''}
                            isAnimationActive={false}
                        />
                        <Legend 
                            verticalAlign="top" 
                            height={30} 
                            iconType="circle" 
                            iconSize={8}
                            wrapperStyle={{ fontSize: '12px', color: 'var(--color-muted-foreground)' }}
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
            </CardContent>
        </Card>
    );
}

export function NetworkChart({ data, currentRx, currentTx }: {
    data: DataPoint[];
    currentRx: number;
    currentTx: number;
}) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Globe size={16} className="text-muted-foreground" />
                        <h3 className="text-sm font-semibold text-foreground tracking-wide">Network</h3>
                    </div>
                <div className="flex gap-4 text-right">
                    <div>
                        <span className="text-xs text-muted-foreground uppercase font-semibold mr-2">TX</span>
                        <span className="text-lg font-mono text-foreground">{formatBps(currentTx)}</span>
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground uppercase font-semibold mr-2">RX</span>
                        <span className="text-lg font-mono text-foreground">{formatBps(currentRx)}</span>
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
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--color-border)" />
                        <YAxis hide />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'var(--color-surface)', 
                                border: '1px solid var(--color-border)', 
                                borderRadius: '0.5rem', 
                                color: 'var(--color-foreground)', 
                                fontSize: '12px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
                            }}
                            labelStyle={{ color: 'var(--color-muted-foreground)', marginBottom: '4px' }}
                            formatter={(value: any, name: any) => [formatBps(Number(value)), name === 'rx' ? 'RX (Down)' : 'TX (Up)']}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.time || ''}
                            isAnimationActive={false}
                        />
                        <Legend 
                            verticalAlign="top" 
                            height={30} 
                            iconType="circle" 
                            iconSize={8}
                            wrapperStyle={{ fontSize: '12px', color: 'var(--color-muted-foreground)' }}
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
            </CardContent>
        </Card>
    );
}

export function DiskUsageCard({ used, total }: { used: number; total: number }) {
    const pct = total > 0 ? (used / total) * 100 : 0;
    const free = Math.max(0, total - used);
    
    let colorClass = 'from-primary to-primary/70';
    let textColor = 'text-primary';
    let bgColor = 'bg-primary/10';
    let borderColor = 'border-primary/20';
    
    if (pct > 90) {
        colorClass = 'from-danger to-danger/70';
        textColor = 'text-danger';
        bgColor = 'bg-danger/10';
        borderColor = 'border-danger/20';
    } else if (pct > 75) {
        colorClass = 'from-warning to-warning/70';
        textColor = 'text-warning';
        bgColor = 'bg-warning/10';
        borderColor = 'border-warning/20';
    }
    
    return (
        <Card className="group hover:border-primary/30 transition-all duration-300">
            <CardContent className="p-6">
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                            Storage
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">Main Disk Mount (/minecraft)</p>
                    </div>
                    <div className={`p-3 ${bgColor} rounded-xl border ${borderColor} shadow-sm group-hover:scale-105 transition-transform duration-300`}>
                        <HardDrive className={textColor} size={22} />
                    </div>
                </div>
            
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Used</span>
                            <span className="text-2xl font-mono font-semibold text-foreground leading-none">
                                {used.toFixed(1)}<span className="text-sm text-muted-foreground ml-1">GB</span>
                            </span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Free</span>
                            <span className="text-2xl font-mono font-semibold text-foreground leading-none">
                                {free.toFixed(1)}<span className="text-sm text-muted-foreground ml-1">GB</span>
                            </span>
                        </div>
                    </div>
                    
                    <div className="relative h-2.5 w-full bg-background rounded-full overflow-hidden border border-border/50 shadow-inner">
                        <div
                            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${colorClass}`}
                            style={{ width: `${pct}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 rounded-full" style={{ maskImage: 'linear-gradient(to bottom, white, transparent)' }} />
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs font-medium">
                        <span className={textColor}>{pct.toFixed(1)}% Capacity</span>
                        <span className="text-muted-foreground">{total.toFixed(1)} GB Total</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
