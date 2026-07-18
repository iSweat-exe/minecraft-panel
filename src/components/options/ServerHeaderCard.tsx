import React from 'react';
import { Globe, Settings2 } from 'lucide-react';
import { EditableMinecraftText } from '../MinecraftText';
import { ServerProps } from '../../hooks/useServerOptions';

interface ServerHeaderCardProps {
    serverIcon: string | null;
    properties: ServerProps;
    updateProp: (key: string, value: string) => void;
}

export const ServerHeaderCard: React.FC<ServerHeaderCardProps> = ({ serverIcon, properties, updateProp }) => {
    return (
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
    );
};
