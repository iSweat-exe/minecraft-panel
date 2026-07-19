import React from 'react';
import { RefreshCw } from 'lucide-react';
import { PlayerDetailsModal } from './PlayerDetailsModal';
import { usePlayers } from '../hooks/usePlayers';
import { PlayerToolbar } from './players/PlayerToolbar';
import { PlayerTable } from './players/PlayerTable';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

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
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Joueurs</h1>
                    <p className="text-muted-foreground text-sm mt-1">Gérez vos joueurs, opérateurs et bannissements</p>
                </div>
                <Button 
                    onClick={fetchPlayers}
                    disabled={loading}
                    variant="outline"
                    className="flex items-center gap-2"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    Refresh
                </Button>
            </div>

            <Card className="overflow-hidden flex flex-col border-0">
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
            </Card>
            
            {selectedPlayer && (
                <PlayerDetailsModal 
                    player={selectedPlayer}
                    onClose={() => setSelectedPlayer(null)}
                />
            )}
        </div>
    );
};
