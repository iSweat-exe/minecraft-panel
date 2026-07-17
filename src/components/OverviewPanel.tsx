import React, { useEffect, useState, useRef, useCallback } from 'react';
import { tauriBridge, SystemMetrics } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';

const MAX_HISTORY = 60; // 60 data points = 5 minutes at 5s intervals

interface MetricHistory {
    cpu: number[];
    ram: number[];
}

function MiniGraph({ data, max, color, label, current, unit }: {
    data: number[];
    max: number;
    color: string;
    label: string;
    current: string;
    unit: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || data.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, w, h);

        // Draw grid lines
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = (h / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Draw filled area
        const step = w / (MAX_HISTORY - 1);
        const offset = MAX_HISTORY - data.length;

        ctx.beginPath();
        ctx.moveTo(offset * step, h);
        for (let i = 0; i < data.length; i++) {
            const x = (offset + i) * step;
            const y = h - (data[i] / max) * h;
            ctx.lineTo(x, y);
        }
        ctx.lineTo((offset + data.length - 1) * step, h);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(1, color + '05');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw line
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
            const x = (offset + i) * step;
            const y = h - (data[i] / max) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }, [data, max, color]);

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-baseline justify-between mb-3">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
                <span className="text-sm font-mono text-zinc-200">{current}<span className="text-zinc-500 text-xs ml-1">{unit}</span></span>
            </div>
            <canvas
                ref={canvasRef}
                className="w-full h-24 block"
                style={{ imageRendering: 'auto' }}
            />
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
    const [history, setHistory] = useState<MetricHistory>({ cpu: [], ram: [] });

    const fetchMetrics = useCallback(async () => {
        try {
            const m = await tauriBridge.systemMetrics();
            setMetrics(m);
            setHistory(prev => ({
                cpu: [...prev.cpu.slice(-(MAX_HISTORY - 1)), m.cpu_percent],
                ram: [...prev.ram.slice(-(MAX_HISTORY - 1)), m.ram_total_mb > 0 ? (m.ram_used_mb / m.ram_total_mb) * 100 : 0],
            }));
        } catch (e) {
            console.error('Failed to fetch metrics:', e);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 5_000);
        return () => clearInterval(interval);
    }, [fetchMetrics]);

    const isOnline = mcPing?.online ?? false;

    return (
        <div className="h-full overflow-y-auto space-y-4">
            {/* Server status bar */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center gap-4">
                <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
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
                <MiniGraph
                    data={history.cpu}
                    max={100}
                    color="#6366f1"
                    label="CPU"
                    current={metrics?.cpu_percent.toFixed(1) ?? '—'}
                    unit="%"
                />
                <MiniGraph
                    data={history.ram}
                    max={100}
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
