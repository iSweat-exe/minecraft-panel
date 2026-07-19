import React from 'react';
import { Globe, Settings2, Check } from 'lucide-react';
import { EditableMinecraftText } from '../MinecraftText';
import { ServerProps } from '../../hooks/useServerOptions';
import { useConnectionStore } from '../../store/connectionStore';

interface ServerHeaderCardProps {
    serverIcon: string | null;
    properties: ServerProps;
    updateProp: (key: string, value: string) => void;
}

export const ServerHeaderCard: React.FC<ServerHeaderCardProps> = ({ serverIcon, properties, updateProp }) => {
    const mcPing = useConnectionStore(state => state.mcPing);
    
    // Check if server is online via ping
    const isOnline = mcPing?.online;

    return (
        <div className="flex flex-col gap-1 w-full max-w-[800px]">
            <div className="relative bg-background/40 border-2 border-border p-1.5 shadow-sm flex items-start gap-3 transition-colors">
                
                {/* Server Icon 64x64 */}
                <div className="relative w-16 h-16 bg-surface border-2 border-border shrink-0 overflow-hidden">
                    {serverIcon ? (
                        <img src={serverIcon} alt="Server Icon" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-surface">
                            <Globe size={28} />
                        </div>
                    )}
                    {/* Active check overlay if online */}
                    {isOnline && (
                        <div className="absolute top-1 right-1 bg-success rounded-full p-0.5 shadow-sm">
                            <Check size={12} className="text-white" strokeWidth={3} />
                        </div>
                    )}
                </div>

                {/* Middle text */}
                <div className="flex-1 min-w-0 flex flex-col justify-between h-16 py-0.5">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 group w-full max-w-[200px] lg:max-w-xs mt-0.5">
                            <input
                                type="text"
                                value={properties['server-ip'] || ''}
                                onChange={(e) => updateProp('server-ip', e.target.value)}
                                placeholder="Uwu SMP"
                                className="font-bold text-foreground text-[16px] leading-none truncate bg-transparent border-none p-0 focus:ring-0 w-full focus:outline-none placeholder:text-muted-foreground"
                            />
                            <Settings2 size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                        
                        {/* Right side Ping/Status */}
                        <div className="flex items-center gap-1.5 shrink-0 ml-4 pointer-events-none mt-0.5">
                            <span className={`text-[12px] font-bold ${isOnline ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {isOnline ? `${mcPing.players_online || 0}/${mcPing.players_max || 20}` : '0/0'}
                            </span>
                            {isOnline ? (
                                <div className="flex items-end gap-[1.5px] h-[14px]">
                                    <div className="w-1 bg-success h-[4px]"></div>
                                    <div className="w-1 bg-success h-[7px]"></div>
                                    <div className="w-1 bg-success h-[10px]"></div>
                                    <div className="w-1 bg-success h-[13px]"></div>
                                    <div className="w-1 bg-success h-[16px]"></div>
                                </div>
                            ) : (
                                <div className="flex items-end gap-[1.5px] h-[14px] opacity-30">
                                    <div className="w-1 bg-muted-foreground h-[4px]"></div>
                                    <div className="w-1 bg-muted-foreground h-[7px]"></div>
                                    <div className="w-1 bg-muted-foreground h-[10px]"></div>
                                    <div className="w-1 bg-muted-foreground h-[13px]"></div>
                                    <div className="w-1 bg-muted-foreground h-[16px]"></div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-[13px] leading-[1.3] mt-1">
                        <EditableMinecraftText 
                            value={properties['motd'] || ''}
                            onChange={(val) => updateProp('motd', val)}
                            placeholder="Un serveur Minecraft"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
