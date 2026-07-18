import { useState, useEffect, useCallback } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';

export interface PlayerInfo {
    uuid: string;
    name: string;
    isOp: boolean;
    isBanned: boolean;
    isWhitelisted: boolean;
    isOnline: boolean;
}

export function usePlayers() {
    const { mcPing } = useConnectionStore();
    const [players, setPlayers] = useState<PlayerInfo[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'online' | 'ops' | 'banned' | 'whitelisted'>('all');
    const [selectedPlayer, setSelectedPlayer] = useState<PlayerInfo | null>(null);

    const fetchPlayers = useCallback(async () => {
        setLoading(true);
        try {
            // Read JSON files
            const readJson = async (path: string) => {
                try {
                    const content = await tauriBridge.sftpReadFile(path);
                    return JSON.parse(content);
                } catch {
                    return [];
                }
            };

            const [usercache, ops, banned, whitelist] = await Promise.all([
                readJson('/minecraft/usercache.json'),
                readJson('/minecraft/ops.json'),
                readJson('/minecraft/banned-players.json'),
                readJson('/minecraft/whitelist.json')
            ]);

            const opUuids = new Set(ops.map((p: any) => p.uuid));
            const bannedUuids = new Set(banned.map((p: any) => p.uuid));
            const whitelistUuids = new Set(whitelist.map((p: any) => p.uuid));
            
            // We use usercache as the source of truth for all players who ever joined
            const allPlayers: PlayerInfo[] = usercache.map((p: any) => ({
                uuid: p.uuid,
                name: p.name,
                isOp: opUuids.has(p.uuid),
                isBanned: bannedUuids.has(p.uuid),
                isWhitelisted: whitelistUuids.has(p.uuid),
                isOnline: mcPing?.sample?.some(s => s.id.replace(/-/g, '') === p.uuid.replace(/-/g, '')) ?? false
            }));

            // Include ops/banned/whitelist that might not be in usercache
            const allUuids = new Set(allPlayers.map(p => p.uuid));
            
            const addMissing = (list: any[], isOp: boolean, isBanned: boolean, isWhitelisted: boolean) => {
                for (const p of list) {
                    if (!allUuids.has(p.uuid)) {
                        allPlayers.push({
                            uuid: p.uuid,
                            name: p.name,
                            isOp,
                            isBanned,
                            isWhitelisted,
                            isOnline: false
                        });
                        allUuids.add(p.uuid);
                    }
                }
            };

            addMissing(ops, true, false, false);
            addMissing(banned, false, true, false);
            addMissing(whitelist, false, false, true);

            setPlayers(allPlayers);
        } catch (error) {
            console.error("Failed to fetch players:", error);
        } finally {
            setLoading(false);
        }
    }, [mcPing?.sample]);

    useEffect(() => {
        fetchPlayers();
    }, [fetchPlayers]); 

    // Update online status when mcPing changes without re-fetching JSONs
    useEffect(() => {
        if (!mcPing || players.length === 0) return;
        
        setPlayers(prev => prev.map(p => {
            const isOnline = mcPing.sample?.some(s => s.id.replace(/-/g, '') === p.uuid.replace(/-/g, '')) ?? false;
            if (p.isOnline !== isOnline) {
                return { ...p, isOnline };
            }
            return p;
        }));
    }, [mcPing]);

    const executeCommand = async (command: string) => {
        try {
            await tauriBridge.consoleSendCommand(command);
            setTimeout(fetchPlayers, 500); // Refresh list after command executes
        } catch (error) {
            console.error("Failed to execute command:", error);
        }
    };

    const filteredPlayers = players.filter(p => {
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filter === 'online' && !p.isOnline) return false;
        if (filter === 'ops' && !p.isOp) return false;
        if (filter === 'banned' && !p.isBanned) return false;
        if (filter === 'whitelisted' && !p.isWhitelisted) return false;
        return true;
    }).sort((a, b) => {
        // Online players first, then ops, then alphabetical
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        if (a.isOp !== b.isOp) return a.isOp ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    return {
        players: filteredPlayers,
        loading,
        search,
        setSearch,
        filter,
        setFilter,
        selectedPlayer,
        setSelectedPlayer,
        fetchPlayers,
        executeCommand
    };
}
