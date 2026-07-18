import React from 'react';
import { Shield, ShieldAlert, UserCheck, Ban, X, Check, UserMinus } from 'lucide-react';
import { PlayerInfo } from '../../hooks/usePlayers';
import { mc } from '../../lib/minecraftCommands';

interface PlayerTableProps {
    players: PlayerInfo[];
    onSelectPlayer: (player: PlayerInfo) => void;
    onExecuteCommand: (command: string) => void;
}

export const PlayerTable: React.FC<PlayerTableProps> = ({ players, onSelectPlayer, onExecuteCommand }) => {
    if (players.length === 0) {
        return (
            <div className="p-8 text-center text-zinc-500">
                Aucun joueur trouvé.
            </div>
        );
    }

    return (
        <div className="divide-y divide-zinc-800/50 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {players.map(player => (
                <div key={player.uuid} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/20 transition-colors">
                    <div 
                        className="flex items-center gap-4 cursor-pointer group"
                        onClick={() => onSelectPlayer(player)}
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
                                onClick={() => onExecuteCommand(mc.player.kick(player.name))}
                                className="px-3 py-1.5 text-xs font-medium rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20 flex items-center gap-1.5 transition-colors"
                            >
                                <UserMinus size={14} /> Kick
                            </button>
                        ) : null}

                        {player.isOp ? (
                            <button 
                                onClick={() => onExecuteCommand(mc.player.deop(player.name))}
                                className="px-3 py-1.5 text-xs font-medium rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border border-zinc-700 flex items-center gap-1.5 transition-colors"
                            >
                                <Shield size={14} /> Deop
                            </button>
                        ) : (
                            <button 
                                onClick={() => onExecuteCommand(mc.player.op(player.name))}
                                className="px-3 py-1.5 text-xs font-medium rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 flex items-center gap-1.5 transition-colors"
                            >
                                <ShieldAlert size={14} /> Op
                            </button>
                        )}

                        {player.isBanned ? (
                            <button 
                                onClick={() => onExecuteCommand(mc.player.pardon(player.name))}
                                className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-1.5 transition-colors"
                            >
                                <UserCheck size={14} /> Pardon
                            </button>
                        ) : (
                            <button 
                                onClick={() => onExecuteCommand(mc.player.ban(player.name))}
                                className="px-3 py-1.5 text-xs font-medium rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 flex items-center gap-1.5 transition-colors"
                            >
                                <Ban size={14} /> Ban
                            </button>
                        )}

                        {player.isWhitelisted ? (
                            <button 
                                onClick={() => onExecuteCommand(mc.whitelist.remove(player.name))}
                                className="px-3 py-1.5 text-xs font-medium rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 border border-zinc-700 flex items-center gap-1.5 transition-colors"
                            >
                                <X size={14} /> Un-WL
                            </button>
                        ) : (
                            <button 
                                onClick={() => onExecuteCommand(mc.whitelist.add(player.name))}
                                className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-1.5 transition-colors"
                            >
                                <Check size={14} /> WL
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
