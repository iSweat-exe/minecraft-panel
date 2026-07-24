import { useState, useEffect, useCallback, useRef } from 'react';
import { tauriBridge, SystemMetricsResponse } from '../lib/tauriBridge';

export function useServerStats() {
    const [metrics, setMetrics] = useState<SystemMetricsResponse | null>(null);
    const isMounted = useRef(true);

    const handleMetrics = useCallback((m: SystemMetricsResponse) => {
        setMetrics(m);
    }, []);

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

