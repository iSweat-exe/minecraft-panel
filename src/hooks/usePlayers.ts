import { useState, useMemo } from 'react';
import { useConnectionStore } from '../store/connectionStore';
import { usePlayersQuery, useExecuteCommandMutation } from '../api/players';
import type { PlayerInfo } from '../api/players';

export interface PlayerInfoWithStatus extends PlayerInfo {
    isOnline: boolean;
}

export function usePlayers() {
    const { mcPing } = useConnectionStore();
    const { data: rawPlayers = [], isLoading: loading, refetch: fetchPlayers } = usePlayersQuery();
    const { mutateAsync: executeCommandMutation } = useExecuteCommandMutation();
    
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'online' | 'ops' | 'banned' | 'whitelisted'>('all');
    const [selectedPlayer, setSelectedPlayer] = useState<PlayerInfoWithStatus | null>(null);

    const players: PlayerInfoWithStatus[] = useMemo(() => {
        return rawPlayers.map(p => ({
            ...p,
            isOnline: mcPing?.sample?.some(s => s.id.replace(/-/g, '') === p.uuid.replace(/-/g, '')) ?? false
        }));
    }, [rawPlayers, mcPing]);

    const executeCommand = async (command: string) => {
        try {
            await executeCommandMutation(command);
        } catch (error) {
            console.error("Failed to execute command:", error);
        }
    };

    const filteredPlayers = useMemo(() => {
        return players.filter(p => {
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
    }, [players, search, filter]);

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
