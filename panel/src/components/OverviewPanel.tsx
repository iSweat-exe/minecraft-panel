import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionStore } from '../store/connectionStore';
import { useServerStats } from '../hooks/useServerStats';
import { useServerStatsStore } from '../store/serverStatsStore';
import { Server, Users, Activity, Clock } from 'lucide-react';
import { ServerControls } from './ServerControls';
import { MetricChart, NetworkChart, DiskUsageCard } from './overview/ResourceCharts';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { StatusIndicator, StatusType } from './ui/StatusIndicator';

type TimeRange = '1m' | '5m' | '15m' | '1h' | '1d';

export const OverviewPanel: React.FC = () => {
    const navigate = useNavigate();
    const { mcPing, pendingAction, host } = useConnectionStore();
    const { metrics } = useServerStats();
    const { rawPoints, historicalPoints } = useServerStatsStore();
    
    const [timeRange, setTimeRange] = useState<TimeRange>('5m');
    const [chartScale, setChartScale] = useState<'local' | 'global'>('local');

    const history = useMemo(() => {
        switch (timeRange) {
            case '1m': return rawPoints.slice(-60);
            case '5m': return rawPoints.slice(-300);
            case '15m': return rawPoints;
            case '1h': return historicalPoints.slice(-60);
            case '1d': return historicalPoints;
            default: return rawPoints.slice(-300);
        }
    }, [timeRange, rawPoints, historicalPoints]);

    const isOnline = mcPing?.online ?? false;

    const getStatusInfo = (): { status: StatusType; label: string } => {
        if (pendingAction) {
            const labels: Record<string, string> = {
                'starting': 'Démarrage...',
                'stopping': 'Arrêt...',
                'restarting': 'Redémarrage...'
            };
            return { status: 'pending', label: labels[pendingAction] || 'Action en cours...' };
        }
        return {
            status: isOnline ? 'online' : 'offline',
            label: isOnline ? 'En ligne' : 'Hors ligne'
        };
    };

    const statusInfo = getStatusInfo();

    return (
        <div className="h-full overflow-y-auto p-6 space-y-6">
            <Card className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-lg border border-primary/20">
                        <Server className="text-primary" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground tracking-tight">{host || 'Minecraft Server'}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <StatusIndicator status={statusInfo.status} label={statusInfo.label} size="sm" />
                        </div>
                    </div>
                </div>

                <div className="flex gap-8">
                    <div className="flex flex-col items-end justify-center">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
                            <Users size={14} /> Joueurs
                        </div>
                        <div className="text-2xl font-mono text-foreground">
                            {mcPing?.players_online ?? 0} <span className="text-muted-foreground text-lg">/ {mcPing?.players_max ?? 0}</span>
                        </div>
                    </div>
                    <div className="w-px h-12 bg-border" />
                    <div className="flex flex-col items-end justify-center">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
                            <Activity size={14} /> Latence
                        </div>
                        <div className="text-2xl font-mono text-foreground">
                            {mcPing?.latency_ms ?? 0} <span className="text-muted-foreground text-lg">ms</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                    <Clock size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground mr-2">Période:</span>
                    {(['1m', '5m', '15m', '1h', '1d'] as TimeRange[]).map((range) => (
                        <Button
                            key={range}
                            variant={timeRange === range ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setTimeRange(range)}
                            className={timeRange === range ? "" : "text-muted-foreground"}
                        >
                            {range}
                        </Button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={chartScale === 'local' ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setChartScale('local')}
                        className={chartScale === 'local' ? "" : "text-muted-foreground"}
                    >
                        Local
                    </Button>
                    <Button
                        variant={chartScale === 'global' ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setChartScale('global')}
                        className={chartScale === 'global' ? "" : "text-muted-foreground"}
                    >
                        Global
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <MetricChart 
                    data={history} 
                    dataKey="cpu" 
                    color="var(--color-primary)" 
                    label="CPU Usage" 
                    current={metrics ? metrics.cpu_percent.toFixed(1) : "0.0"} 
                    unit="%" 
                />
                <MetricChart 
                    data={history} 
                    dataKey="ram" 
                    color="var(--color-primary)" 
                    label="Memory Usage" 
                    current={metrics ? (metrics.ram_used_mb >= 1024 ? (metrics.ram_used_mb / 1024).toFixed(1) : metrics.ram_used_mb.toString()) : "0"} 
                    unit={metrics && metrics.ram_used_mb >= 1024 ? "GB" : "MB"} 
                    maxValue={chartScale === 'global' && metrics ? metrics.ram_total_mb : undefined}
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
                    onManageFiles={() => navigate('/files')}
                />
            </div>
        </div>
    );
};
