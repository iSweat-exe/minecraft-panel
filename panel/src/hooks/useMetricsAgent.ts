import { useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useServerStatsStore } from '../store/serverStatsStore';

export function useMetricsAgent() {
    useEffect(() => {
        let isMounted = true;

        const fetchMetrics = async () => {
            if (!isMounted) return;
            try {
                const host = localStorage.getItem('node_host');
                const port = localStorage.getItem('node_port') || '8080';
                const token = localStorage.getItem('node_token');
                if (!host || !token) return;

                const nodeUrl = `http://${host}:${port}`;
                const metrics = await tauriBridge.nodeGetMetrics(nodeUrl, token);
                
                const now = new Date();
                const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                
                useServerStatsStore.getState().addPoint({
                    time: timeStr,
                    ts: now.getTime(),
                    cpu: metrics.cpu_percent,
                    ram: metrics.ram_used_mb,
                    rx: metrics.network_rx_bps,
                    tx: metrics.network_tx_bps
                });
            } catch (err) {
                // Silently ignore daemon metrics fetch errors so we don't spam console when disconnected
            }
        };

        // Fetch immediately
        fetchMetrics();

        // Then every second
        const interval = setInterval(fetchMetrics, 1000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);
}
