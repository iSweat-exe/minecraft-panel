import { useState, useEffect, useCallback, useRef } from 'react';
import { tauriBridge, SystemMetricsResponse } from '../lib/tauriBridge';
import { useServerStatsStore } from '../store/serverStatsStore';

export function useServerStats() {
    const [metrics, setMetrics] = useState<SystemMetricsResponse | null>(null);
    const addPoint = useServerStatsStore(state => state.addPoint);
    const isMounted = useRef(true);

    const handleMetrics = useCallback((m: SystemMetricsResponse) => {
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
        isMounted.current = true;
        
        const fetchMetrics = async () => {
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            
            if (!host || !token) return;
            
            try {
                const nodeUrl = `http://${host}:${port}`;
                const result = await tauriBridge.nodeGetMetrics(nodeUrl, token);
                if (isMounted.current) {
                    handleMetrics(result);
                }
            } catch (err) {
                console.error("Failed to fetch node metrics:", err);
            }
        };

        // Fetch immediately then every 2 seconds
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 2000);

        return () => {
            isMounted.current = false;
            clearInterval(interval);
        };
    }, [handleMetrics]);

    return { metrics };
}

