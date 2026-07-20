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
            const rawPlayers = await tauriBridge.getPlayersList();
            
            const allPlayers: PlayerInfo[] = rawPlayers.map(p => ({
                uuid: p.uuid,
                name: p.name,
                isOp: p.isOp,
                isBanned: p.isBanned,
                isWhitelisted: p.isWhitelisted,
                isOnline: mcPing?.sample?.some(s => s.id.replace(/-/g, '') === p.uuid.replace(/-/g, '')) ?? false
            }));

            setPlayers(allPlayers);
        } catch (error) {
            console.error("Failed to fetch players:", error);
        } finally {
            setLoading(false);
        }
    }, []); // Removed mcPing?.sample to prevent re-fetching 4 files every 15 seconds

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
