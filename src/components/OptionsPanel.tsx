import React, { useState, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { AlertCircle, FileText, Folder, Save, Trash2, Globe, Settings2, Shield, Activity, Users, Database, Layout, RefreshCw, X, Check, Gamepad2 } from 'lucide-react';
import { useConnectionStore } from '../store/connectionStore';
import { EditableMinecraftText } from './MinecraftText';

interface ServerProps {
    'max-players': string;
    'gamemode': string;
    'difficulty': string;
    'white-list': string;
    'online-mode': string;
    'allow-flight': string;
    'force-gamemode': string;
    'spawn-protection': string;
    'require-resource-pack': string;
    'resource-pack': string;
    'resource-pack-prompt': string;
    [key: string]: string;
}

export const OptionsPanel: React.FC = () => {
    const [properties, setProperties] = useState<ServerProps | null>(null);
    const [originalContent, setOriginalContent] = useState<string>("");
    const [serverIcon, setServerIcon] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { mcPing } = useConnectionStore();

    const fetchProperties = async () => {
        setLoading(true);
        try {
            const content = await tauriBridge.sftpReadFile('/minecraft/server.properties');
            setOriginalContent(content);
            const lines = content.split('\n');
            const props: any = {};
            for (const line of lines) {
                if (line.trim().startsWith('#') || line.trim() === '') continue;
                const [key, ...rest] = line.split('=');
                if (key) {
                    props[key.trim()] = rest.join('=').trim();
                }
            }
            setProperties(props);
        } catch (error) {
            console.error("Failed to load server.properties:", error);
        }

        try {
            const base64 = await tauriBridge.sftpReadFileBase64('/minecraft/server-icon.png');
            setServerIcon(`data:image/png;base64,${base64}`);
        } catch (error) {
            // Icon might not exist, silently ignore
            console.log("No server-icon.png found or failed to load");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProperties();
    }, []);

    const handleSave = async () => {
        if (!properties) return;
        setSaving(true);
        try {
            const lines = originalContent.split('\n');
            const updatedLines = lines.map(line => {
                if (line.trim().startsWith('#') || line.trim() === '') return line;
                const key = line.split('=')[0].trim();
                if (key && properties[key] !== undefined) {
                    return `${key}=${properties[key]}`;
                }
                return line;
            });
            
            // Add any missing core props just in case
            const existingKeys = updatedLines.map(l => l.split('=')[0].trim());
            for (const key of Object.keys(properties)) {
                if (!existingKeys.includes(key)) {
                    updatedLines.push(`${key}=${properties[key]}`);
                }
            }

            await tauriBridge.sftpWriteFile('/server.properties', updatedLines.join('\n'));
            setOriginalContent(updatedLines.join('\n'));
        } catch (error) {
            console.error("Failed to save server.properties:", error);
        } finally {
            setSaving(false);
        }
    };

    const updateProp = (key: keyof ServerProps, value: string) => {
        setProperties(prev => prev ? { ...prev, [key]: value } : null);
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center text-zinc-500">
                <RefreshCw className="animate-spin mr-2" size={20} /> Chargement des options...
            </div>
        );
    }

    if (!properties) {
        return (
            <div className="flex flex-col h-full items-center justify-center text-zinc-500">
                <p>Impossible de charger server.properties.</p>
                <button onClick={fetchProperties} className="mt-4 flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded">
                    <RefreshCw size={16} /> Réessayer
                </button>
            </div>
        );
    }

const InputBox = ({ label, propKey, type = "text", icon: Icon, properties, updateProp }: { label: string, propKey: string, type?: string, icon?: any, properties: any, updateProp: (k: string, v: string) => void }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col justify-between focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
        <div className="p-3 flex justify-between items-center bg-zinc-900/50 border-b border-zinc-800">
            <div className="font-semibold text-zinc-200 text-[14px]">{label}</div>
            <div className="text-zinc-600 font-mono text-[10px]">{propKey}</div>
        </div>
        <div className="px-3 py-2 flex items-center bg-zinc-950 min-h-[50px]">
            {Icon && <div className="p-1.5 bg-zinc-900 rounded border border-zinc-800 mr-3"><Icon size={16} className="text-zinc-400" /></div>}
            <input 
                type={type} 
                value={properties[propKey] || ''}
                onChange={(e) => updateProp(propKey, e.target.value)}
                className={`w-full bg-transparent border-0 text-zinc-100 font-mono text-sm focus:outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${!Icon ? 'px-1' : ''}`}
            />
        </div>
    </div>
);

const SelectBox = ({ label, propKey, options, properties, updateProp }: { label: string, propKey: string, options: { value: string, label: string }[], properties: any, updateProp: (k: string, v: string) => void }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col justify-between focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
        <div className="p-3 flex justify-between items-center bg-zinc-900/50 border-b border-zinc-800">
            <div className="font-semibold text-zinc-200 text-[14px]">{label}</div>
            <div className="text-zinc-600 font-mono text-[10px]">{propKey}</div>
        </div>
        <div className="px-3 py-2 bg-zinc-950 min-h-[50px] flex items-center">
            <select 
                value={properties[propKey] || ''}
                onChange={(e) => updateProp(propKey, e.target.value)}
                className="w-full bg-transparent border-0 text-zinc-100 font-mono text-sm focus:outline-none focus:ring-0 p-0 cursor-pointer"
            >
                {options.map(opt => <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-100">{opt.label}</option>)}
            </select>
        </div>
    </div>
);

const ToggleBox = ({ label, propKey, inverted = false, properties, updateProp }: { label: string, propKey: string, inverted?: boolean, properties: any, updateProp: (k: string, v: string) => void }) => {
    let isTrue = properties[propKey] === 'true';
    if (inverted) isTrue = !isTrue;

    const toggle = () => {
        let nextVal = isTrue ? 'false' : 'true';
        if (inverted) nextVal = nextVal === 'true' ? 'false' : 'true';
        updateProp(propKey, nextVal);
    };

    return (
        <div 
            className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col justify-between cursor-pointer group hover:border-zinc-700 transition-colors"
            onClick={toggle}
        >
            <div className="p-3 flex justify-between items-center bg-zinc-900/50 border-b border-zinc-800 group-hover:bg-zinc-800/30 transition-colors">
                <div className="font-semibold text-zinc-200 text-[14px]">{label}</div>
                <div className="text-zinc-600 font-mono text-[10px]">{propKey}</div>
            </div>
            <div className="px-4 py-2 bg-zinc-950 flex justify-between items-center group-hover:bg-zinc-900/30 transition-colors min-h-[50px]">
                <span className="text-sm font-medium text-zinc-400">
                    {isTrue ? 'Activé' : 'Désactivé'}
                </span>
                <button 
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        isTrue ? 'bg-indigo-500' : 'bg-zinc-700'
                    }`}
                >
                    <span 
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            isTrue ? 'translate-x-5' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>
        </div>
    );
};

const Section = ({ title, icon: Icon, children, className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" }: { title: string, icon: any, children: React.ReactNode, className?: string }) => (
    <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/50">
            <Icon className="text-indigo-400" size={18} />
            <h3 className="text-md font-medium text-zinc-200">{title}</h3>
        </div>
        <div className={className}>
            {children}
        </div>
    </div>
);

    return (
        <div className="flex flex-col h-full bg-zinc-950 overflow-hidden relative">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                
                {/* Header Banner */}
                <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden p-6 shadow-sm">
                    {/* Abstract background design element */}
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l to-transparent pointer-events-none" />
                    
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex items-center gap-4 w-full max-w-2xl">
                            <div className="rounded-xl border border-zinc-800 shadow-inner shrink-0 flex items-center justify-center overflow-hidden h-16 w-16 bg-zinc-950">
                                {serverIcon ? (
                                    <img src={serverIcon} alt="Server Icon" className="w-full h-full object-cover" />
                                ) : (
                                    <Globe className="text-indigo-400" size={32} />
                                )}
                            </div>
                            <div className="flex flex-col gap-1 w-full">
                                <div className="flex items-center gap-2 group">
                                    <input
                                        type="text"
                                        value={properties['server-ip'] || ''}
                                        onChange={(e) => updateProp('server-ip', e.target.value)}
                                        placeholder="Uwu SMP"
                                        className="text-xl font-bold text-white tracking-tight bg-transparent border-none p-0 focus:ring-0 w-full focus:outline-none"
                                    />
                                    <Settings2 size={16} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="text-sm">
                                    <EditableMinecraftText 
                                        value={properties['motd'] || ''}
                                        onChange={(val) => updateProp('motd', val)}
                                        placeholder="Un serveur Minecraft"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-8 pb-10">
                    <Section title="Joueurs & Combat" icon={Users}>
                        <InputBox label="Nombre de joueurs" propKey="max-players" type="number" icon={Users} properties={properties} updateProp={updateProp} />
                        <SelectBox label="Mode de jeu" propKey="gamemode" options={[
                            { value: 'survival', label: 'Survie' },
                            { value: 'creative', label: 'Créatif' },
                            { value: 'adventure', label: 'Aventure' },
                            { value: 'spectator', label: 'Spectateur' }
                        ]} properties={properties} updateProp={updateProp} />
                        <SelectBox label="Difficulté" propKey="difficulty" options={[
                            { value: 'peaceful', label: 'Paisible' },
                            { value: 'easy', label: 'Facile' },
                            { value: 'normal', label: 'Normal' },
                            { value: 'hard', label: 'Difficile' }
                        ]} properties={properties} updateProp={updateProp} />
                        <ToggleBox label="Mode Hardcore" propKey="hardcore" properties={properties} updateProp={updateProp} />
                        <ToggleBox label="Forcer le mode de jeu" propKey="force-gamemode" properties={properties} updateProp={updateProp} />
                        <ToggleBox label="PvP" propKey="pvp" properties={properties} updateProp={updateProp} />
                    </Section>

                    <Section title="Monde & Génération" icon={Globe}>
                        <InputBox label="Nom du monde" propKey="level-name" type="text" properties={properties} updateProp={updateProp} />
                        <InputBox label="Graine (Seed)" propKey="level-seed" type="text" properties={properties} updateProp={updateProp} />
                        <InputBox label="Distance de vue" propKey="view-distance" type="number" properties={properties} updateProp={updateProp} />
                        <InputBox label="Protection du spawn" propKey="spawn-protection" type="number" icon={Shield} properties={properties} updateProp={updateProp} />
                    </Section>

                    <Section title="Sécurité & Accès" icon={Shield}>
                        <ToggleBox label="Liste blanche" propKey="white-list" properties={properties} updateProp={updateProp} />
                        <ToggleBox label="Cracké (Offline)" propKey="online-mode" inverted={true} properties={properties} updateProp={updateProp} />
                        <ToggleBox label="Vol autorisé" propKey="allow-flight" properties={properties} updateProp={updateProp} />
                    </Section>

                    <Section title="Pack de Ressources" icon={FileText} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <ToggleBox label="Pack de ressources requis" propKey="require-resource-pack" properties={properties} updateProp={updateProp} />
                        </div>
                        <div className="md:col-span-2">
                            <InputBox label="URL du pack de Ressources" propKey="resource-pack" type="text" properties={properties} updateProp={updateProp} />
                        </div>
                        <div className="md:col-span-2">
                            <InputBox label="Message du pack de ressources" propKey="resource-pack-prompt" type="text" properties={properties} updateProp={updateProp} />
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    );
};
