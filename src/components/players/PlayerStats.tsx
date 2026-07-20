import React from 'react';
import { Plus } from 'lucide-react';
import { tauriBridge } from '../../lib/tauriBridge';
import { mc } from '../../lib/minecraftCommands';

interface PlayerStatsProps {
    playerName: string;
    health: number;
    food: number;
    xp: number;
    setHealthOffset: React.Dispatch<React.SetStateAction<number>>;
    setFoodOffset: React.Dispatch<React.SetStateAction<number>>;
    setXpOffset: React.Dispatch<React.SetStateAction<number>>;
}

export const PlayerStats: React.FC<PlayerStatsProps> = ({
    playerName,
    health,
    food,
    xp,
    setHealthOffset,
    setFoodOffset,
    setXpOffset
}) => {
    return (
        <div className="space-y-3">
            {/* Santé */}
            <div className="flex items-stretch gap-2">
                <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="https://minecraft.wiki/w/Special:FilePath/Heart.svg" className="w-[18px] h-[18px] drop-shadow-md" style={{ imageRendering: 'pixelated' }} alt="Heart" />
                        <span className="font-semibold text-sm text-zinc-300">Santé</span>
                    </div>
                    <div className="flex items-center gap-1 text-red-400 font-minecraft">
                        <span className="text-sm">{health}</span>
                        <span className="text-red-400/50 text-sm">/ 20</span>
                    </div>
                </div>
                <button
                    onClick={async () => {
                        await tauriBridge.consoleSendCommand(mc.player.heal(playerName));
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
                    <div className="flex items-center gap-2">
                        <img src="https://minecraft.wiki/w/Special:FilePath/Hunger.svg" className="w-[18px] h-[18px] drop-shadow-md" style={{ imageRendering: 'pixelated' }} alt="Hunger" />
                        <span className="font-semibold text-sm text-zinc-300">Faim</span>
                    </div>
                    <div className="flex items-center gap-1 text-orange-400 font-minecraft">
                        <span className="text-sm">{food}</span>
                        <span className="text-orange-400/50 text-sm">/ 20</span>
                    </div>
                </div>
                <button
                    onClick={async () => {
                        await tauriBridge.consoleSendCommand(mc.player.feed(playerName));
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
                    <div className="flex items-center gap-2">
                        <img src="https://minecraft.wiki/w/Special:FilePath/Experience_Orb.gif" className="w-[18px] h-[18px] drop-shadow-md" style={{ imageRendering: 'pixelated' }} alt="XP" />
                        <span className="font-semibold text-sm text-zinc-300">Niveau (XP)</span>
                    </div>
                    <div className="font-minecraft text-sm" style={{ color: '#80FF20', textShadow: '2px 2px 0px rgba(0, 0, 0, 0.7)' }}>
                        {xp}
                    </div>
                </div>
                <button
                    onClick={async () => {
                        await tauriBridge.consoleSendCommand(mc.player.addXpLevels(playerName, 1));
                        setXpOffset(prev => prev + 1);
                    }}
                    className="w-12 flex items-center justify-center bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-white"
                    title="Ajouter un niveau"
                >
                    <Plus size={16} />
                </button>
            </div>
        </div>
    );
};
