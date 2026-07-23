import React, { useState, useEffect } from 'react';
import { Server, Layers, RefreshCw, CheckCircle2, ShieldAlert, Save } from 'lucide-react';
import { FaJava } from 'react-icons/fa6';
import { tauriBridge } from '../lib/tauriBridge';
import { logAction } from '../lib/actionLogger';
import { Button } from './ui/Button';

export const VersionPanel: React.FC = () => {
    const [serverType, setServerType] = useState<string>('CUSTOM');
    const [javaVersion, setJavaVersion] = useState<string>('java21');
    const [mcVersion, setMcVersion] = useState<string>('LATEST');
    const [loading, setLoading] = useState<boolean>(true);
    const [updating, setUpdating] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchDockerConfig();
    }, []);

    const fetchDockerConfig = async () => {
        setLoading(true);
        try {
            const envType = await tauriBridge.sshExecute(`docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' minecraft-panel-server 2>/dev/null | grep "^TYPE=" | cut -d= -f2 || echo "CUSTOM"`);
            const envVersion = await tauriBridge.sshExecute(`docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' minecraft-panel-server 2>/dev/null | grep "^VERSION=" | cut -d= -f2 || echo "LATEST"`);
            const imageTag = await tauriBridge.sshExecute(`docker inspect -f '{{.Config.Image}}' minecraft-panel-server 2>/dev/null || echo "itzg/minecraft-server"`);

            if (envType.trim()) setServerType(envType.trim());
            if (envVersion.trim()) setMcVersion(envVersion.trim());
            
            if (imageTag.includes(':')) {
                const tag = imageTag.split(':')[1];
                if (tag) setJavaVersion(tag);
            }
        } catch {
            // Default fallback if container doesn't exist yet
        } finally {
            setLoading(false);
        }
    };

    const handleApplyVersion = async () => {
        setUpdating(true);
        setStatusMessage(null);

        try {
            const image = `itzg/minecraft-server:${javaVersion}`;
            
            // Re-create container with new version/type settings
            const recreateScript = `
                docker stop minecraft-panel-server 2>/dev/null || true
                docker rm minecraft-panel-server 2>/dev/null || true
                docker run -d \
                    --name minecraft-panel-server \
                    --restart unless-stopped \
                    -v /minecraft:/data \
                    -p 25565:25565 \
                    -p 25575:25575 \
                    -e EULA=TRUE \
                    -e TYPE=${serverType} \
                    ${serverType !== 'CUSTOM' ? `-e VERSION=${mcVersion}` : ''} \
                    -e MEMORY=4G \
                    ${image}
            `;

            await tauriBridge.sshExecute(recreateScript);
            await logAction(`Changement de version Minecraft / Environnement (${serverType} - ${mcVersion}, Java ${javaVersion})`, { serverType, mcVersion, javaVersion });
            setStatusMessage({ type: 'success', text: 'Conteneur mis à jour avec succès avec la nouvelle version/image Java !' });
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: `Échec de mise à jour : ${err.message || 'Erreur inconnue'}` });
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground bg-background">
                <RefreshCw className="animate-spin mr-2" size={20} /> Chargement de la configuration...
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative text-foreground">
            {/* Header */}
            <div className="p-6 pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">Version & Environnement</h2>
                        <p className="text-muted-foreground text-sm">
                            Configurez le moteur du serveur, la version de Java et la version de Minecraft.
                        </p>
                    </div>
                    <Button onClick={fetchDockerConfig} variant="secondary" className="gap-2">
                        <RefreshCw size={16} /> Actualiser
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-24 space-y-6">
                
                {/* Docker Active Banner */}
                <div className="bg-surface/40 border border-border p-4 rounded-xl flex items-start gap-3.5">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                        <CheckCircle2 size={18} />
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground">Isolation Docker active</span> (<code className="text-primary font-mono px-1">itzg/minecraft-server</code>)<br />
                        Le mode <code className="bg-background border border-border px-1.5 py-0.5 rounded text-primary font-mono">TYPE=CUSTOM</code> exécute directement votre fichier <code className="bg-background border border-border px-1.5 py-0.5 rounded text-foreground font-mono">server.jar</code> dans <code className="bg-background border border-border px-1.5 py-0.5 rounded text-foreground font-mono">/minecraft/</code> sans modifier vos données.
                    </div>
                </div>

                {/* Server Type */}
                <div className="bg-surface/50 border border-border p-5 rounded-xl space-y-4">
                    <div className="flex items-center gap-2">
                        <Layers size={18} className="text-primary" />
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Type de Serveur (Moteur)</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                            { id: 'CUSTOM', label: 'Custom (Jar existant)', desc: 'Utilise /minecraft/server.jar' },
                            { id: 'PAPER', label: 'Paper', desc: 'Performances & Plugins Spigot' },
                            { id: 'FABRIC', label: 'Fabric', desc: 'Léger & Mods moderne' },
                            { id: 'FORGE', label: 'Forge', desc: 'Mods classiques' },
                            { id: 'VANILLA', label: 'Vanilla', desc: 'Minecraft Officiel' }
                        ].map(type => {
                            const isSelected = serverType === type.id;
                            return (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => setServerType(type.id)}
                                    className={`relative flex flex-col p-4 rounded-xl border text-left transition-all ${
                                        isSelected
                                            ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                                            : 'bg-background hover:bg-surface border-border text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-sm text-foreground">{type.label}</span>
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                                    </div>
                                    <span className="text-xs text-muted-foreground">{type.desc}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Java Version */}
                <div className="bg-surface/50 border border-border p-5 rounded-xl space-y-4">
                    <div className="flex items-center gap-2">
                        <FaJava size={18} className="text-primary" />
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Version de Java Runtime</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                            { id: 'java25', label: 'Java 25', badge: 'Requis MC 26.2 RC+', desc: 'Dernière version & Snapshots' },
                            { id: 'java21', label: 'Java 21', badge: 'Standard', desc: 'Pour MC 1.20.5 - 1.21.x' },
                            { id: 'java17', label: 'Java 17', badge: null, desc: 'Pour MC 1.18 - 1.20.4' },
                            { id: 'java11', label: 'Java 11', badge: null, desc: 'Pour MC 1.13 - 1.16.5' },
                            { id: 'java8', label: 'Java 8', badge: null, desc: 'Pour MC 1.12.2 et antérieur' }
                        ].map(java => {
                            const isSelected = javaVersion === java.id;
                            return (
                                <button
                                    key={java.id}
                                    type="button"
                                    onClick={() => setJavaVersion(java.id)}
                                    className={`relative flex flex-col p-4 rounded-xl border text-left transition-all ${
                                        isSelected
                                            ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                                            : 'bg-background hover:bg-surface border-border text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-foreground">{java.label}</span>
                                            {java.badge && (
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                                    java.id === 'java25' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-surface text-muted-foreground'
                                                }`}>
                                                    {java.badge}
                                                </span>
                                            )}
                                        </div>
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                                    </div>
                                    <span className="text-xs text-muted-foreground mt-1">{java.desc}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Minecraft Version (if not custom) */}
                {serverType !== 'CUSTOM' && (
                    <div className="bg-surface/50 border border-border p-5 rounded-xl space-y-3 animate-in fade-in">
                        <div className="flex items-center gap-2">
                            <Server size={18} className="text-primary" />
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Version de Minecraft</h3>
                        </div>
                        <input
                            type="text"
                            value={mcVersion}
                            onChange={e => setMcVersion(e.target.value)}
                            placeholder="LATEST (ex: 1.20.4)"
                            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground w-full max-w-xs focus:outline-none focus:border-primary"
                        />
                    </div>
                )}

                {statusMessage && (
                    <div className={`p-4 rounded-xl text-xs font-medium flex items-center gap-2 ${
                        statusMessage.type === 'success' ? 'bg-success/15 text-success border border-success/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'
                    }`}>
                        {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
                        {statusMessage.text}
                    </div>
                )}
            </div>

            {/* Floating Action Button */}
            <div className="absolute bottom-6 right-6 z-50">
                <Button
                    onClick={handleApplyVersion}
                    disabled={updating}
                    variant="primary"
                    className="gap-2 rounded-full px-6 py-6 shadow-lg shadow-primary/20"
                >
                    {updating ? (
                        <RefreshCw size={18} className="animate-spin" />
                    ) : (
                        <Save size={18} />
                    )}
                    <span className="font-semibold text-[15px]">
                        {updating ? 'Mise à jour du conteneur...' : 'Enregistrer la configuration'}
                    </span>
                </Button>
            </div>
        </div>
    );
};
