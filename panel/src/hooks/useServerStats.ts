import { useState, useEffect, useCallback } from 'react';
import { tauriBridge, SystemMetrics } from '../lib/tauriBridge';
import { useServerStatsStore } from '../store/serverStatsStore';

export function useServerStats() {
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
    const addPoint = useServerStatsStore(state => state.addPoint);

    const handleMetrics = useCallback((m: SystemMetrics) => {
        setMetrics(m);
        
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        
        const ramPct = m.ram_total_mb > 0 ? (m.ram_used_mb / m.ram_total_mb) * 100 : 0;
        
        addPoint({ 
            time: timeStr, 
            ts: now.getTime(),
            cpu: m.cpu_percent, 
            ram: ramPct, 
            rx: m.network_rx_bps, 
            tx: m.network_tx_bps 
        });
    }, [addPoint]);

    useEffect(() => {
        // Subscribe to streaming metrics (opens a pe.rsistent SSH channel)
        tauriBridge.metricsSubscribe().catch(e => console.error('Failed to subscribe to metrics:', e));

        let unlisten: (() => void) | undefined;
        let isMounted = true;

        tauriBridge.onMetricsUpdate(handleMetrics).then(fn => {
            if (!isMounted) fn();
            else unlisten = fn;
        });

        return () => {
            isMounted = false;
            if (unlisten) unlisten();
            tauriBridge.metricsUnsubscribe().catch(e => console.error('Failed to unsubscribe from metrics:', e));
        };
    }, [handleMetrics]);

    return { metrics };
}
