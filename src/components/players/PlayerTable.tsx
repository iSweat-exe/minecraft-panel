import React from 'react';
import { Shield, ShieldAlert, UserCheck, Ban, X, Check, UserMinus } from 'lucide-react';
import type { PlayerInfoWithStatus } from '../../hooks/usePlayers';
import { mc } from '../../lib/minecraftCommands';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';

interface PlayerTableProps {
    players: PlayerInfoWithStatus[];
    onSelectPlayer: (player: PlayerInfoWithStatus) => void;
    onExecuteCommand: (command: string) => void;
}

export const PlayerTable: React.FC<PlayerTableProps> = ({ players, onSelectPlayer, onExecuteCommand }) => {
    if (players.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                Aucun joueur trouvé.
            </div>
        );
    }

    return (
        <div className="max-h-[60vh]">
            <Table>
                <TableHeader className="sticky top-0 bg-zinc-950/90 backdrop-blur z-10">
                    <TableRow>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {players.map(player => (
                        <TableRow key={player.uuid}>
                            <TableCell>
                                <div 
                                    className="flex items-center gap-4 cursor-pointer group w-fit"
                                    onClick={() => onSelectPlayer(player)}
                                >
                                    <img 
                                        src={`https://mc-heads.net/avatar/${player.uuid}/40`} 
                                        alt={player.name}
                                        className={`w-10 h-10 rounded-md bg-surface group-hover:scale-105 transition-transform ${player.isOnline ? 'ring-2 ring-success ring-offset-2 ring-offset-background' : ''}`}
                                    />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{player.name}</span>
                                            {player.isOp && <Badge variant="default">OP</Badge>}
                                            {player.isBanned && <Badge variant="danger">BANNED</Badge>}
                                            {player.isWhitelisted && <Badge variant="success">WHITELIST</Badge>}
                                        </div>
                                        <span className="text-xs text-muted-foreground font-mono">{player.uuid}</span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                        {player.isOnline ? (
                            <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => onExecuteCommand(mc.player.kick(player.name))}
                                className="text-warning border-warning/20 hover:bg-warning/10 gap-1.5"
                            >
                                <UserMinus size={14} /> Kick
                            </Button>
                        ) : null}

                        {player.isOp ? (
                            <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => onExecuteCommand(mc.player.deop(player.name))}
                                className="gap-1.5"
                            >
                                <Shield size={14} /> Deop
                            </Button>
                        ) : (
                            <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => onExecuteCommand(mc.player.op(player.name))}
                                className="text-primary border-primary/20 hover:bg-primary/10 gap-1.5"
                            >
                                <ShieldAlert size={14} /> Op
                            </Button>
                        )}

                        {player.isBanned ? (
                            <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => onExecuteCommand(mc.player.pardon(player.name))}
                                className="text-success border-success/20 hover:bg-success/10 gap-1.5"
                            >
                                <UserCheck size={14} /> Pardon
                            </Button>
                        ) : (
                            <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => onExecuteCommand(mc.player.ban(player.name))}
                                className="text-danger border-danger/20 hover:bg-danger/10 gap-1.5"
                            >
                                <Ban size={14} /> Ban
                            </Button>
                        )}

                        {player.isWhitelisted ? (
                            <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => onExecuteCommand(mc.whitelist.remove(player.name))}
                                className="gap-1.5"
                            >
                                <X size={14} /> Un-WL
                            </Button>
                        ) : (
                            <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => onExecuteCommand(mc.whitelist.add(player.name))}
                                className="text-success border-success/20 hover:bg-success/10 gap-1.5"
                            >
                                <Check size={14} /> WL
                            </Button>
                        )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
