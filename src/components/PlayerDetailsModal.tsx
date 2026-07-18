import React, { useState, useEffect } from 'react';
import { X, Heart, Utensils, Zap, Box, HardDrive, Download, AlertCircle, Plus } from 'lucide-react';
import { tauriBridge } from '../lib/tauriBridge';
import * as nbt from 'nbtify';

interface PlayerInfo {
    uuid: string;
    name: string;
}

interface PlayerDetailsModalProps {
    player: PlayerInfo;
    onClose: () => void;
}

const InventoryGrid = ({ items, cols, totalSlots, slotMap }: { items: any[], cols: number, totalSlots: number, slotMap?: (i: number) => number }) => {
    // Helpers to extract values robustly from NBT objects (handles different Minecraft versions and nbtify shapes)
    const getSlot = (item: any): number => {
        const val = item.Slot ?? item.slot;
        if (val === undefined || val === null) return -1;
        return Number(typeof val === 'object' && 'value' in val ? val.value : val.valueOf());
    };

    const getCount = (item: any): number => {
        const val = item.Count ?? item.count;
        if (val === undefined || val === null) return 1;
        const num = Number(typeof val === 'object' && 'value' in val ? val.value : val.valueOf());
        return isNaN(num) ? 1 : num;
    };

    const getId = (item: any): string => {
        const val = item.id;
        if (!val) return '';
        return String(typeof val === 'object' && 'value' in val ? val.value : val.valueOf());
    };
    
    return (
        <div 
            className="grid gap-1 bg-zinc-950 p-2 rounded-lg border border-zinc-800"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
            {Array.from({ length: totalSlots }).map((_, i) => {
                const actualSlot = slotMap ? slotMap(i) : i;
                const item = items.find(it => getSlot(it) === actualSlot);
                
                return (
                    <div 
                        key={i} 
                        className="aspect-square bg-zinc-800/50 rounded border border-zinc-700/50 relative group flex items-center justify-center hover:bg-zinc-700 transition-colors"
                    >
                        {item && (
                            <>
                                {/* Item icon placeholder / text */}
                                <div className="w-8 h-8 flex items-center justify-center">
                                    <span className="text-[10px] text-zinc-300 font-mono overflow-hidden text-center leading-tight line-clamp-2 break-all" title={getId(item)}>
                                        {getId(item).replace('minecraft:', '')}
                                    </span>
                                </div>
                                
                                {/* Item Count */}
                                {getCount(item) > 1 && (
                                    <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-white drop-shadow-md">
                                        {getCount(item)}
                                    </span>
                                )}

                                {/* Hover Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
                                    <div className="font-semibold text-indigo-300">{getId(item)}</div>
                                    <div>Quantité: {getCount(item)}</div>
                                    {item.tag && <div className="text-zinc-500 mt-1 italic text-[10px]">Possède des tags (NBT)</div>}
                                </div>
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export const PlayerDetailsModal: React.FC<PlayerDetailsModalProps> = ({ player, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nbtData, setNbtData] = useState<any>(null);
    const [healthOffset, setHealthOffset] = useState(0);
    const [foodOffset, setFoodOffset] = useState(0);
    const [xpOffset, setXpOffset] = useState(0);
    
    const [config, setConfig] = useState<{
        rconEnabled: boolean;
        rconPort: number;
        rconPass: string;
        actualFilePath: string;
    } | null>(null);

    useEffect(() => {
        let isMounted = true;

        const initConfig = async () => {
            let levelName = 'world';
            let rconEnabled = false;
            let rconPort = 25575;
            let rconPass = "";

            try {
                const props = await tauriBridge.sftpReadFile('/minecraft/server.properties');
                const match = props.match(/^level-name=(.*)$/m);
                if (match && match[1]) {
                    levelName = match[1].trim();
                }
                const rconEnableMatch = props.match(/^enable-rcon=(.*)$/m);
                if (rconEnableMatch && rconEnableMatch[1].trim() === 'true') {
                    rconEnabled = true;
                }
                const rconPortMatch = props.match(/^rcon\.port=(.*)$/m);
                if (rconPortMatch) {
                    rconPort = parseInt(rconPortMatch[1].trim(), 10);
                }
                const rconPassMatch = props.match(/^rcon\.password=(.*)$/m);
                if (rconPassMatch) {
                    rconPass = rconPassMatch[1].trim();
                }
            } catch (e) {
                // Ignore error
            }

            const possibleDirs = [
                `/minecraft/${levelName}/playerdata`,
                `/minecraft/${levelName}/players/data`
            ];

            let actualFilePath = "";
            
            for (const dir of possibleDirs) {
                try {
                    const files = await tauriBridge.sftpListDir(dir);
                    const flatUuid = player.uuid.replace(/-/g, '').toLowerCase();
                    const matchedFile = files.find(f => f.name.toLowerCase().replace(/-/g, '') === `${flatUuid}.dat`);
                    
                    const fileName = matchedFile ? matchedFile.name : `${player.uuid}.dat`;
                    actualFilePath = `${dir}/${fileName}`;
                    break;
                } catch (e) {
                }
            }

            if (!actualFilePath) {
                actualFilePath = `/minecraft/${levelName}/playerdata/${player.uuid}.dat`;
            }

            if (isMounted) {
                setConfig({ rconEnabled, rconPort, rconPass, actualFilePath });
            }
        };

        initConfig();

        return () => {
            isMounted = false;
        };
    }, [player.uuid]);

    useEffect(() => {
        if (!config) return;
        let isMounted = true;

        const fetchLive = async () => {
            try {
                let parsed;
                if (!nbtData) {
                    let base64;
                    try {
                        base64 = await tauriBridge.sftpReadFileBase64(config.actualFilePath);
                    } catch (e) {
                        throw new Error(`Fichier introuvable (${config.actualFilePath}).`);
                    }
                    
                    const binaryString = window.atob(base64);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    parsed = await nbt.read(bytes);
                }
                
                let finalNbt: any = nbtData ? { ...nbtData } : (parsed.data || parsed);

                if (config.rconEnabled && config.rconPass) {
                    try {
                        const commands = [
                            `data get entity ${player.name} Health`,
                            `data get entity ${player.name} foodLevel`,
                            `data get entity ${player.name} XpLevel`,
                            `data get entity ${player.name} Inventory`,
                            `data get entity ${player.name} EnderItems`
                        ];

                        const results = await tauriBridge.rconExecuteMulti(commands, config.rconPort, config.rconPass);
                        const [rawHealth, rawFood, rawXp, rawInv, rawEnder] = results;

                        const matchH = rawHealth.match(/data: ([\d.]+)f?/i);
                        if (matchH) finalNbt.Health = { valueOf: () => parseFloat(matchH[1]) };

                        const matchF = rawFood.match(/data: ([\d.]+)f?/i);
                        if (matchF) finalNbt.foodLevel = { valueOf: () => parseInt(matchF[1], 10) };

                        const matchX = rawXp.match(/data: ([\d.]+)f?/i);
                        if (matchX) finalNbt.XpLevel = { valueOf: () => parseInt(matchX[1], 10) };

                        const matchInv = rawInv.match(/data: (\[.*\])/);
                        if (matchInv) {
                            try {
                                finalNbt.Inventory = nbt.parse(matchInv[1]);
                            } catch (e) {
                                console.warn("Failed to parse live Inventory SNBT", e);
                            }
                        }

                        const matchEnder = rawEnder.match(/data: (\[.*\])/);
                        if (matchEnder) {
                            try {
                                finalNbt.EnderItems = nbt.parse(matchEnder[1]);
                            } catch (e) {
                                console.warn("Failed to parse live EnderItems SNBT", e);
                            }
                        }
                        
                        if (matchH && matchF && matchX) {
                            setHealthOffset(0);
                            setFoodOffset(0);
                            setXpOffset(0);
                        }
                    } catch (e) {
                        console.warn("RCON live data fetch failed", e);
                    }
                }

                if (isMounted) {
                    setNbtData(finalNbt);
                    setError(null);
                }
            } catch (err: any) {
                if (isMounted) {
                    console.error("Failed to fetch/parse player NBT:", err);
                    setError(`Erreur: ${err.message || err}`);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchLive();
        const intervalId = setInterval(fetchLive, 1000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [config, player.name]);

    const health = Math.min(20, (nbtData ? Math.round(Number(nbtData.Health?.valueOf() ?? 0)) : 0) + healthOffset);
    const food = Math.min(20, (nbtData ? Number(nbtData.foodLevel?.valueOf() ?? 0) : 0) + foodOffset);
    const xp = (nbtData ? Number(nbtData.XpLevel?.valueOf() ?? 0) : 0) + xpOffset;
    const inventory = nbtData ? (Array.isArray(nbtData.Inventory) ? nbtData.Inventory : nbtData.Inventory?.valueOf() ?? []) : [];
    const enderItems = nbtData ? (Array.isArray(nbtData.EnderItems) ? nbtData.EnderItems : nbtData.EnderItems?.valueOf() ?? []) : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <img 
                            src={`https://mc-heads.net/avatar/${player.uuid}/40`} 
                            alt={player.name} 
                            className="w-10 h-10 rounded shadow-md image-rendering-pixelated"
                        />
                        <div>
                            <h2 className="text-lg font-bold text-zinc-100">{player.name}</h2>
                            <p className="text-xs text-zinc-500 font-mono">{player.uuid}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <a 
                            href={`https://mc-heads.net/download/${player.uuid}`} 
                            download={`${player.name}_skin.png`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-sm transition-colors"
                        >
                            <Download size={14} />
                            <span>Skin</span>
                        </a>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8">
                    {/* Left Column: Skin & Stats */}
                    <div className="w-full md:w-1/3 space-y-6">
                        {/* 3D Skin Render */}
                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-6 flex justify-center items-center relative overflow-hidden h-[300px]">
                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500 via-zinc-900 to-transparent"></div>
                            <img 
                                src={`https://mc-heads.net/body/${player.uuid}`} 
                                alt={player.name} 
                                className="h-full object-contain drop-shadow-2xl image-rendering-pixelated z-10"
                            />
                        </div>

                        {/* Quick Stats */}
                        {loading ? (
                            <div className="animate-pulse space-y-3">
                                <div className="h-10 bg-zinc-800 rounded"></div>
                                <div className="h-10 bg-zinc-800 rounded"></div>
                                <div className="h-10 bg-zinc-800 rounded"></div>
                            </div>
                        ) : error ? (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                                <p className="text-sm text-red-300">{error}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Santé */}
                                <div className="flex items-stretch gap-2">
                                    <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-red-400">
                                            <Heart size={18} className="fill-red-400/20" />
                                            <span className="font-semibold text-sm">Santé</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-red-400 font-mono">
                                            <span>{health}</span>
                                            <span className="text-red-400/50 text-xs">/ 20</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={async () => {
                                            await tauriBridge.consoleSendCommand(`effect give ${player.name} instant_health 1 0`);
                                            setHealthOffset(prev => prev + 4);
                                        }}
                                        className="w-12 flex items-center justify-center bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-white"
                                        title="Soigner (+4 HP / 2 Coeurs)"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>

                                {/* Faim */}
                                <div className="flex items-stretch gap-2">
                                    <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-orange-400">
                                            <Utensils size={18} className="fill-orange-400/20" />
                                            <span className="font-semibold text-sm">Faim</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-orange-400 font-mono">
                                            <span>{food}</span>
                                            <span className="text-orange-400/50 text-xs">/ 20</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={async () => {
                                            await tauriBridge.consoleSendCommand(`effect give ${player.name} saturation 1 0`);
                                            setFoodOffset(prev => prev + 1);
                                        }}
                                        className="w-12 flex items-center justify-center bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-white"
                                        title="Nourrir (+1 Faim + 2 Saturation)"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>

                                {/* Niveau XP */}
                                <div className="flex items-stretch gap-2">
                                    <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-green-400">
                                            <Zap size={18} className="fill-green-400/20" />
                                            <span className="font-semibold text-sm">Niveau (XP)</span>
                                        </div>
                                        <div className="text-green-400 font-mono">
                                            {xp}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={async () => {
                                            await tauriBridge.consoleSendCommand(`xp add ${player.name} 1 levels`);
                                            setXpOffset(prev => prev + 1);
                                        }}
                                        className="w-12 flex items-center justify-center bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-white"
                                        title="Ajouter un niveau"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Inventory */}
                    <div className="w-full md:w-2/3 space-y-6">
                        {loading ? (
                            <div className="animate-pulse space-y-6">
                                <div className="h-48 bg-zinc-800 rounded"></div>
                                <div className="h-48 bg-zinc-800 rounded"></div>
                            </div>
                        ) : error ? (
                            <div className="h-full flex items-center justify-center text-zinc-500 italic">
                                Données indisponibles
                            </div>
                        ) : (
                            <>
                                <div>
                                    <div className="flex items-center gap-2 text-zinc-300 mb-3">
                                        <Box size={18} className="text-indigo-400" />
                                        <h3 className="font-semibold text-sm">Inventaire & Armure</h3>
                                    </div>
                                    
                                    <div className="flex gap-4">
                                        {/* Main Inventory + Hotbar */}
                                        <div className="flex-1 space-y-2">
                                            {/* Main 3 rows (slots 9-35) */}
                                            <InventoryGrid 
                                                items={inventory} 
                                                cols={9} 
                                                totalSlots={27} 
                                                slotMap={(i) => i + 9} 
                                            />
                                            {/* Hotbar (slots 0-8) */}
                                            <div className="pt-2">
                                                <InventoryGrid 
                                                    items={inventory} 
                                                    cols={9} 
                                                    totalSlots={9} 
                                                    slotMap={(i) => i} 
                                                />
                                            </div>
                                        </div>

                                        {/* Armor & Offhand */}
                                        <div className="w-16 space-y-2 flex flex-col justify-between">
                                            <InventoryGrid 
                                                items={inventory} 
                                                cols={1} 
                                                totalSlots={4} 
                                                slotMap={(i) => 103 - i} // Helmet(103), Chest(102), Legs(101), Boots(100)
                                            />
                                            <div className="pt-2">
                                                <InventoryGrid 
                                                    items={inventory} 
                                                    cols={1} 
                                                    totalSlots={1} 
                                                    slotMap={() => -106} // Offhand
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-zinc-800/50">
                                    <div className="flex items-center gap-2 text-zinc-300 mb-3">
                                        <HardDrive size={18} className="text-fuchsia-400" />
                                        <h3 className="font-semibold text-sm">Ender Chest</h3>
                                    </div>
                                    <div className="w-full max-w-[calc(100%-5rem)]">
                                        <InventoryGrid 
                                            items={enderItems} 
                                            cols={9} 
                                            totalSlots={27} 
                                            slotMap={(i) => i} 
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
