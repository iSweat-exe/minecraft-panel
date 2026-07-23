import React, { useEffect, useState, useRef } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { tauriBridge, SystemHostResponse, SystemHealthResponse } from '../lib/tauriBridge';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Server, Activity, HardDrive, Cpu, Terminal, ShieldAlert, RefreshCw } from 'lucide-react';
import { formatBytes } from '../lib/utils';
import { useToastStore } from '../store/toastStore';

export const SystemPanel: React.FC = () => {
    const { host } = useConnectionStore();
    const port = localStorage.getItem('node_port') || '8080';
    const token = localStorage.getItem('node_token');
    const nodeUrl = host && port ? `http://${host}:${port}` : '';
    
    const [systemHost, setSystemHost] = useState<SystemHostResponse | null>(null);
    const [systemHealth, setSystemHealth] = useState<SystemHealthResponse | null>(null);
    const [daemonLogs, setDaemonLogs] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const fetchData = async () => {
        if (!nodeUrl || !token) return;
        setIsLoading(true);
        try {
            const [hostInfo, healthInfo, logs] = await Promise.all([
                tauriBridge.nodeGetSystemHost(nodeUrl, token).catch(() => null),
                tauriBridge.nodeGetSystemHealth(nodeUrl, token).catch(() => null),
                tauriBridge.nodeGetSystemLogs(nodeUrl, token, 100).catch(() => null),
            ]);
            
            if (hostInfo) setSystemHost(hostInfo);
            if (healthInfo) setSystemHealth(healthInfo);
            if (logs) setDaemonLogs(logs.lines);
        } catch (error) {
            console.error("Failed to fetch system data", error);
            useToastStore.getState().addToast({ type: 'error', message: "Erreur lors du chargement des informations système" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!token) return;
        try {
            await tauriBridge.nodeSendCommand(nodeUrl, token, "default", "daemon update");
            useToastStore.getState().addToast({ type: 'success', message: "Commande de mise à jour envoyée" });
        } catch (e) {
            useToastStore.getState().addToast({ type: 'error', message: "Erreur: " + String(e) });
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [nodeUrl, token]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [daemonLogs]);

    if (isLoading && !systemHost) {
        return <div className="h-full flex items-center justify-center"><RefreshCw className="animate-spin text-primary" size={32} /></div>;
    }

    return (
        <div className="h-full overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Server className="text-primary" /> Système & Nœud
                </h1>
                <div className="flex gap-2">
                    <Button onClick={handleUpdate} variant="outline" size="sm" className="flex items-center gap-2 border-primary/50 text-primary hover:bg-primary/10">
                        <RefreshCw size={16} /> Mettre à jour le Daemon
                    </Button>
                    <Button onClick={fetchData} variant="secondary" size="sm" className="flex items-center gap-2">
                        <RefreshCw size={16} /> Rafraîchir
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground font-semibold uppercase text-xs">
                        <Cpu size={16} /> Processeur
                    </div>
                    <div className="text-lg font-bold text-foreground">
                        {systemHost?.cpu_model || 'Inconnu'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {systemHost?.cpu_cores} Cœurs @ {(systemHost?.cpu_freq_mhz || 0) / 1000} GHz
                    </div>
                </Card>

                <Card className="p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground font-semibold uppercase text-xs">
                        <Activity size={16} /> Système d'Exploitation
                    </div>
                    <div className="text-lg font-bold text-foreground capitalize">
                        {systemHost?.os_name || 'Inconnu'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Kernel: {systemHost?.os_version}
                    </div>
                </Card>

                <Card className="p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground font-semibold uppercase text-xs">
                        <HardDrive size={16} /> Stockage Principal
                    </div>
                    <div className="text-lg font-bold text-foreground">
                        {formatBytes((systemHost?.disk_total_mb || 0) * 1024 * 1024)} Total
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {formatBytes((systemHost?.disk_free_mb || 0) * 1024 * 1024)} Libres
                    </div>
                </Card>

                <Card className="p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground font-semibold uppercase text-xs">
                        <ShieldAlert size={16} /> Santé du Nœud
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${systemHealth?.docker_responsive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="font-bold">Docker {systemHealth?.docker_responsive ? 'OK' : 'Injoignable'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <div className={`w-2 h-2 rounded-full ${!systemHealth?.disk_space_warning ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <span className="text-muted-foreground">Espace Disque {systemHealth?.disk_space_warning ? 'Faible' : 'OK'}</span>
                    </div>
                </Card>
            </div>

            <Card className="flex flex-col h-[400px]">
                <div className="p-4 border-b border-border flex justify-between items-center bg-card-hover">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                        <Terminal size={18} className="text-primary" /> Logs du Daemon (Statique)
                    </div>
                </div>
                <div className="flex-1 p-4 bg-[#0d1117] overflow-y-auto font-mono text-xs whitespace-pre text-gray-300">
                    {daemonLogs.length === 0 ? (
                        <div className="text-muted-foreground italic">Aucun log disponible...</div>
                    ) : (
                        daemonLogs.map((line, idx) => (
                            <div key={idx} className="hover:bg-white/5 px-1 rounded">{line}</div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </Card>

        </div>
    );
};
