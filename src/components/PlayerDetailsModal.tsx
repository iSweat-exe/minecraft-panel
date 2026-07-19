import React from 'react';
import { X, Download, AlertCircle } from 'lucide-react';
import { PlayerInfo } from '../hooks/usePlayers';
import { usePlayerDetails } from '../hooks/usePlayerDetails';
import { PlayerStats } from './players/PlayerStats';
import { PlayerInventory } from './players/PlayerInventory';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface PlayerDetailsModalProps {
    player: PlayerInfo;
    onClose: () => void;
}

export const PlayerDetailsModal: React.FC<PlayerDetailsModalProps> = ({ player, onClose }) => {
    const {
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
    } = usePlayerDetails(player);

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title=""
            maxWidth="max-w-5xl"
            maxHeight="max-h-none overflow-visible"
            footer={null}
        >
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-border">
                <div className="flex items-center gap-3">
                    <img 
                        src={`https://mc-heads.net/avatar/${player.uuid}/40`} 
                        alt={player.name} 
                        className="w-10 h-10 rounded shadow-md image-rendering-pixelated"
                    />
                    <div>
                        <h2 className="text-lg font-bold text-foreground">{player.name}</h2>
                        <p className="text-xs text-muted-foreground font-mono">{player.uuid}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        onClick={() => window.open(`https://mc-heads.net/download/${player.uuid}`, '_blank')}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                    >
                        <Download size={14} />
                        <span>Skin</span>
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
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
                            <PlayerStats 
                                playerName={player.name}
                                health={health}
                                food={food}
                                xp={xp}
                                setHealthOffset={setHealthOffset}
                                setFoodOffset={setFoodOffset}
                                setXpOffset={setXpOffset}
                            />
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
                            <PlayerInventory 
                                inventory={inventory}
                                enderItems={enderItems}
                            />
                        )}
                    </div>
            </div>
        </Modal>
    );
};
