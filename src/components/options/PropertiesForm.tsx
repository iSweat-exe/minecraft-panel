import React from 'react';
import { Users, Globe, Shield, FileText } from 'lucide-react';
import { ServerProps } from '../../hooks/useServerOptions';

interface PropertiesFormProps {
    properties: ServerProps;
    updateProp: (key: string, value: string) => void;
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

export const PropertiesForm: React.FC<PropertiesFormProps> = ({ properties, updateProp }) => {
    return (
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
    );
};
