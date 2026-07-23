import { useState, useEffect, useRef } from 'react';
import { tauriBridge } from '../../lib/tauriBridge';
import * as nbt from 'nbtify';
import { mc } from '../../lib/minecraftCommands';
import { PlayerConfig } from './usePlayerConfig';

export function usePlayerSync(playerName: string, config: PlayerConfig | null) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nbtData, setNbtData] = useState<any>(null);
    const nbtDataRef = useRef<any>(null);
    const [healthOffset, setHealthOffset] = useState(0);
    const [foodOffset, setFoodOffset] = useState(0);
    const [xpOffset, setXpOffset] = useState(0);

    useEffect(() => {
        if (!config) return;
        let isMounted = true;
        let timeoutId: number;

        const fetchLive = async () => {
            try {
                let parsed;
                if (!nbtDataRef.current) {
                    let base64;
                    try {
                        const host = localStorage.getItem('node_host');
                        const port = localStorage.getItem('node_port') || '8080';
                        const token = localStorage.getItem('node_token');
                        if (!host || !token) throw new Error("Daemon credentials missing");
                        const nodeUrl = `http://${host}:${port}`;
                        
                        base64 = await tauriBridge.nodeReadFile(nodeUrl, token, config.actualFilePath);
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
                
                let finalNbt: any = nbtDataRef.current ? { ...nbtDataRef.current } : (parsed ? (parsed.data || parsed) : {});

                if (config.rconEnabled && config.rconPass) {
                    try {
                        const commands = [
                            mc.data.getHealth(playerName),
                            mc.data.getFoodLevel(playerName),
                            mc.data.getXpLevel(playerName),
                            mc.data.getInventory(playerName),
                            mc.data.getEnderItems(playerName)
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
                    nbtDataRef.current = finalNbt;
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
                    timeoutId = window.setTimeout(fetchLive, 1000);
                }
            }
        };

        fetchLive();

        return () => {
            isMounted = false;
            if (timeoutId) window.clearTimeout(timeoutId);
            nbtDataRef.current = null;
        };
    }, [config, playerName]);

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
