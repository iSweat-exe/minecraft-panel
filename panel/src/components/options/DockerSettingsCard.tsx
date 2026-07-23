import React, { useState, useEffect } from 'react';
import { Globe, CheckCircle2, AlertTriangle } from 'lucide-react';
import { tauriBridge } from '../../lib/tauriBridge';
import { logAction } from '../../lib/actionLogger';
import { Button } from '../ui/Button';

const RAM_PRESETS = [2, 4, 6, 8, 12, 16, 24, 32];

export const DockerSettingsCard: React.FC = () => {
    const [ramGb, setRamGb] = useState<number>(4);
    const [totalHostGb, setTotalHostGb] = useState<number>(16);
    const [updating, setUpdating] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    useEffect(() => {
        const host = localStorage.getItem('node_host');
        const port = localStorage.getItem('node_port') || '8080';
        const token = localStorage.getItem('node_token');
        if (!host || !token) return;
        const nodeUrl = `http://${host}:${port}`;

        // Fetch host system total memory via metrics API
        tauriBridge.nodeGetMetrics(nodeUrl, token)
            .then(m => {
                if (m.ram_total_mb > 0) {
                    setTotalHostGb(Math.max(Math.round(m.ram_total_mb / 1024), 2));
                }
            })
            .catch(() => {});

        // Fetch active docker container memory limit if available
        tauriBridge.nodeInspectContainer(nodeUrl, token, 'default')
            .then(info => {
                const bytes = info?.HostConfig?.Memory || 0;
                if (bytes > 0) {
                    const gb = Math.round(bytes / (1024 * 1024 * 1024));
                    if (gb > 0) setRamGb(gb);
                }
            })
            .catch(() => {});
    }, []);

    const handleRamChange = async (targetGb: number) => {
        const validGb = Math.min(Math.max(targetGb, 1), totalHostGb);
        setRamGb(validGb);
        setUpdating(true);
        setStatusMessage(null);

        try {
            await tauriBridge.sshExecute(
                `docker update --memory=${validGb}g --memory-swap=${validGb}g mc-server-default 2>/dev/null || true`
            );
            await logAction(`Modification de l'allocation RAM Docker à ${validGb} Go`, { ramGb: validGb });
            setStatusMessage(`RAM mise à jour à ${validGb} Go (${validGb * 1024} Mo)`);
        } catch (e: any) {
            setStatusMessage(`Erreur: ${e.message || 'Échec'}`);
        } finally {
            setUpdating(false);
            setTimeout(() => setStatusMessage(null), 3000);
        }
    };

    const handleFixDns = async () => {
        setUpdating(true);
        setStatusMessage(null);

        try {
            const script = `
                mkdir -p /etc/docker
                if [ -f /etc/docker/daemon.json ]; then
                    python3 -c 'import json; f=open("/etc/docker/daemon.json", "r+"); d=json.load(f); d["dns"]=["1.1.1.1", "8.8.8.8"]; f.seek(0); json.dump(d, f, indent=2); f.truncate()' 2>/dev/null || echo '{"dns": ["1.1.1.1", "8.8.8.8"]}' > /etc/docker/daemon.json
                else
                    echo '{"dns": ["1.1.1.1", "8.8.8.8"]}' > /etc/docker/daemon.json
                fi
                (systemctl restart docker || service docker restart) 2>/dev/null || true
            `;

            await tauriBridge.sshExecute(script);
            await logAction("Application du correctif DNS IPv4 Docker (1.1.1.1 / 8.8.8.8)", {});
            setStatusMessage("DNS Docker configurés sur 1.1.1.1 & 8.8.8.8 ! Démon redémarré.");
        } catch (e: any) {
            setStatusMessage(`Erreur: ${e.message || e}`);
        } finally {
            setUpdating(false);
            setTimeout(() => setStatusMessage(null), 4000);
        }
    };

    const percent = Math.min(Math.round((ramGb / totalHostGb) * 100), 100);
    const sliderPercent = totalHostGb > 1 ? Math.min(Math.max(((ramGb - 1) / (totalHostGb - 1)) * 100, 0), 100) : 0;

    const colorHex = percent > 80 ? '#f43f5e' : percent > 50 ? '#f59e0b' : '#10b981';

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-surface">
            {/* Main Content Area */}
            <div className="p-6 bg-surface flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                {/* SECTION 1: RAM Allocation Card */}
                <div className="bg-background/60 border border-border rounded-xl p-5 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-sm font-semibold text-foreground">
                                Allocation Mémoire VIVE (RAM)
                            </h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Ajustement dynamique sans arrêt du serveur (Hot Memory Update).
                            </p>
                        </div>

                        <span className="text-xs font-mono font-bold">
                            {ramGb} / {totalHostGb} Go ({percent}%)
                        </span>
                    </div>

                    {/* Slider */}
                    <div className="space-y-2 py-1">
                        <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-muted-foreground">1 Go</span>
                            <span className="font-bold text-xs" style={{ color: colorHex }}>
                                {ramGb} Go alloué ({percent}% du VPS)
                            </span>
                            <span className="text-muted-foreground">{totalHostGb} Go (Max)</span>
                        </div>

                        <div className="relative flex items-center">
                            <input 
                                type="range"
                                min={1}
                                max={totalHostGb}
                                step={1}
                                value={ramGb}
                                onChange={(e) => setRamGb(parseInt(e.target.value, 10))}
                                onMouseUp={() => handleRamChange(ramGb)}
                                onTouchEnd={() => handleRamChange(ramGb)}
                                className="w-full h-2.5 rounded-lg appearance-none cursor-pointer focus:outline-none"
                                style={{
                                    background: `linear-gradient(to right, ${colorHex} 0%, ${colorHex} ${sliderPercent}%, rgba(255,255,255,0.08) ${sliderPercent}%, rgba(255,255,255,0.08) 100%)`,
                                    accentColor: colorHex
                                }}
                            />
                        </div>

                        {percent > 80 && (
                            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg mt-2">
                                <AlertTriangle size={14} className="shrink-0" />
                                <span>Attention : Vous allouez plus de 80% de la mémoire du serveur hôte. Conservez de la RAM pour l'OS Linux et Docker.</span>
                            </div>
                        )}
                    </div>

                    {/* Presets Row */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                        {RAM_PRESETS.filter(gb => gb <= totalHostGb).map((gb) => {
                            const isActive = ramGb === gb;
                            return (
                                <button
                                    key={gb}
                                    type="button"
                                    onClick={() => handleRamChange(gb)}
                                    className={`px-3.5 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-all ${
                                        isActive
                                            ? 'bg-docker text-white border-docker shadow-sm ring-1 ring-docker'
                                            : 'bg-background/80 hover:bg-background border-border text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {gb} Go
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* SECTION 2: Network DNS & Restart Policy Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* DNS Fix Card */}
                    <div className="flex items-center justify-between gap-4 p-4 bg-background/60 border border-border rounded-xl">
                        <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h4 className="text-xs font-semibold text-foreground truncate">
                                    Correctif DNS IPv4 (Mojang / VPS)
                                </h4>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Force les serveurs DNS Cloudflare (<code className="font-mono text-foreground">1.1.1.1</code>) & Google (<code className="font-mono text-foreground">8.8.8.8</code>).
                            </p>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleFixDns}
                            disabled={updating}
                            className="shrink-0 gap-1.5 border-docker/30 hover:bg-docker/10 hover:text-docker text-xs font-semibold h-9 px-3.5"
                        >
                            <Globe size={13} />
                            {updating ? 'Application...' : 'Fix DNS'}
                        </Button>
                    </div>

                    {/* Restart Policy Card */}
                    <div className="flex items-center justify-between gap-4 p-4 bg-background/60 border border-border rounded-xl">
                        <div className="space-y-1 min-w-0">
                            <div>
                                <h4 className="text-xs font-semibold text-foreground truncate">
                                    Redémarrage Automatique
                                </h4>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Redémarre en cas de crash ou reboot VPS (<code className="font-mono text-foreground">unless-stopped</code>).
                            </p>
                        </div>

                        <span className="inline-flex items-center gap-1.5 text-xs text-success font-semibold px-2.5 py-1 bg-success/10 rounded-lg border border-success/20 shrink-0">
                            <CheckCircle2 size={13} /> Actif
                        </span>
                    </div>
                </div>

                {/* Status Message Notification */}
                {statusMessage && (
                    <div className="p-3.5 rounded-xl bg-docker/10 border border-docker/20 text-xs text-docker font-medium animate-in fade-in flex items-center gap-2.5 shadow-sm">
                        <CheckCircle2 size={15} className="shrink-0" />
                        <span className="flex-1">{statusMessage}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
