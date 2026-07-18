import React, { useState, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { Search, UserCog, Ban, UserCheck, ShieldAlert, UserMinus, Shield, ShieldQuestion, Check, RefreshCw, X } from 'lucide-react';
import { PlayerDetailsModal } from './PlayerDetailsModal';

interface PlayerInfo {
    uuid: string;
    name: string;
    isOp: boolean;
    isBanned: boolean;
    isWhitelisted: boolean;
    isOnline: boolean;
}

export const PlayersPanel: React.FC = () => {
    const { mcPing } = useConnectionStore();
    const [players, setPlayers] = useState<PlayerInfo[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'online' | 'ops' | 'banned' | 'whitelisted'>('all');
    const [selectedPlayer, setSelectedPlayer] = useState<PlayerInfo | null>(null);

    const fetchPlayers = async () => {
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
    };

    useEffect(() => {
        fetchPlayers();
    }, []); // Only fetch on mount or manual refresh

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

    return (
        <div className="h-full overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Joueurs</h1>
                    <p className="text-zinc-500 text-sm mt-1">Gérez vos joueurs, opérateurs et bannissements</p>
                </div>
                <button 
                    onClick={fetchPlayers}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 rounded-lg transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-4 border-b border-zinc-800 flex flex-col md:flex-row md:items-center gap-4 justify-between bg-zinc-900/50">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Rechercher un joueur..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm rounded-lg pl-9 pr-4 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                    </div>
                    <div className="flex gap-2">
                        {(['all', 'online', 'ops', 'banned', 'whitelisted'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                                    filter === f 
                                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                                        : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="divide-y divide-zinc-800/50 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {filteredPlayers.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500">
                            Aucun joueur trouvé.
                        </div>
                    ) : (
                        filteredPlayers.map(player => (
                            <div key={player.uuid} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/20 transition-colors">
                                <div 
                                    className="flex items-center gap-4 cursor-pointer group"
                                    onClick={() => setSelectedPlayer(player)}
                                >
                                    <img 
                                        src={`https://mc-heads.net/avatar/${player.uuid}/40`} 
                                        alt={player.name}
                                        className={`w-10 h-10 rounded-md bg-zinc-800 group-hover:scale-105 transition-transform ${player.isOnline ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-zinc-900' : ''}`}
                                    />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-zinc-200 group-hover:text-indigo-300 transition-colors">{player.name}</span>
                                            {player.isOp && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">OP</span>}
                                            {player.isBanned && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">BANNED</span>}
                                            {player.isWhitelisted && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">WHITELIST</span>}
                                        </div>
                                        <span className="text-xs text-zinc-500 font-mono">{player.uuid}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {player.isOnline ? (
                                        <button 
                                            onClick={() => executeCommand(`kick ${player.name}`)}
                                            className="px-3 py-1.5 text-xs font-medium rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20 flex items-center gap-1.5 transition-colors"
                                        >
                                            <UserMinus size={14} /> Kick
                                        </button>
                                    ) : null}

                                    {player.isOp ? (
                                        <button 
                                            onClick={() => executeCommand(`deop ${player.name}`)}
                                            className="px-3 py-1.5 text-xs font-medium rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border border-zinc-700 flex items-center gap-1.5 transition-colors"
                                        >
                                            <Shield size={14} /> Deop
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => executeCommand(`op ${player.name}`)}
                                            className="px-3 py-1.5 text-xs font-medium rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 flex items-center gap-1.5 transition-colors"
                                        >
                                            <ShieldAlert size={14} /> Op
                                        </button>
                                    )}

                                    {player.isBanned ? (
                                        <button 
                                            onClick={() => executeCommand(`pardon ${player.name}`)}
                                            className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-1.5 transition-colors"
                                        >
                                            <UserCheck size={14} /> Pardon
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => executeCommand(`ban ${player.name}`)}
                                            className="px-3 py-1.5 text-xs font-medium rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 flex items-center gap-1.5 transition-colors"
                                        >
                                            <Ban size={14} /> Ban
                                        </button>
                                    )}

                                    {player.isWhitelisted ? (
                                        <button 
                                            onClick={() => executeCommand(`whitelist remove ${player.name}`)}
                                            className="px-3 py-1.5 text-xs font-medium rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border border-zinc-700 flex items-center gap-1.5 transition-colors"
                                        >
                                            <X size={14} /> Un-WL
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => executeCommand(`whitelist add ${player.name}`)}
                                            className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-1.5 transition-colors"
                                        >
                                            <Check size={14} /> WL
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            
            {selectedPlayer && (
                <PlayerDetailsModal 
                    player={selectedPlayer}
                    onClose={() => setSelectedPlayer(null)}
                />
            )}
        </div>
    );
};
