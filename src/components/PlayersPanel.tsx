import React from 'react';
import { RefreshCw } from 'lucide-react';
import { PlayerDetailsModal } from './PlayerDetailsModal';
import { usePlayers } from '../hooks/usePlayers';
import { PlayerToolbar } from './players/PlayerToolbar';
import { PlayerTable } from './players/PlayerTable';

export const PlayersPanel: React.FC = () => {
    const {
        players,
        loading,
        search,
        setSearch,
        filter,
        setFilter,
        selectedPlayer,
        setSelectedPlayer,
        fetchPlayers,
        executeCommand
    } = usePlayers();

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
                <PlayerToolbar 
                    search={search}
                    setSearch={setSearch}
                    filter={filter}
                    setFilter={setFilter}
                />

                <PlayerTable 
                    players={players}
                    onSelectPlayer={setSelectedPlayer}
                    onExecuteCommand={executeCommand}
                />
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
