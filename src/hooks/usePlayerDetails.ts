import { useState, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import * as nbt from 'nbtify';
import { PlayerInfo } from './usePlayers';
import { mc } from '../lib/minecraftCommands';

export function usePlayerDetails(player: PlayerInfo) {
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
                
                let finalNbt: any = nbtData ? { ...nbtData } : (parsed ? (parsed.data || parsed) : {});

                if (config.rconEnabled && config.rconPass) {
                    try {
                        const commands = [
                            mc.data.getHealth(player.name),
                            mc.data.getFoodLevel(player.name),
                            mc.data.getXpLevel(player.name),
                            mc.data.getInventory(player.name),
                            mc.data.getEnderItems(player.name)
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

    return {
        loading,
        error,
        health,
        food,
        xp,
        inventory,
        enderItems,
        setHealthOffset,
        setFoodOffset,
        setXpOffset
    };
}
