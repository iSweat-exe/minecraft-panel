import React from 'react';
import { useWorlds } from '../hooks/useWorlds';
import { Globe, AlertCircle, RefreshCw, CheckCircle2, Play } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/Table';

export const WorldsPanel: React.FC = () => {
    const { worlds, loading, error, setActiveWorld, fetchWorlds } = useWorlds();

    return (
        <Card className="flex flex-col h-full bg-background/50 p-6 border-border/50 shadow-none">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Globe className="text-primary" />
                        Gestion des Mondes
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Sélectionnez le monde actif pour le serveur.
                    </p>
                </div>
                <Button
                    onClick={fetchWorlds}
                    disabled={loading}
                    variant="outline"
                    className="p-2"
                >
                    <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                </Button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3 text-danger">
                    <AlertCircle size={20} className="shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {/* Worlds Table */}
            <div className="flex-1 overflow-auto bg-surface/30 rounded-xl border border-border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>World Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {worlds.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-16">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <Globe size={48} className="mb-4 opacity-20" />
                                        <p className="text-lg font-medium mb-1">Aucun monde trouvé.</p>
                                        <p className="text-sm">Assurez-vous qu'il y a des dossiers avec 'level.dat' dans /minecraft</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {worlds.map(world => (
                            <TableRow key={world.name}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${world.isActive ? 'bg-success/10 text-success' : 'bg-surface text-muted-foreground'}`}>
                                            <Globe size={20} />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-foreground">{world.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {world.isActive ? "Serveur actuel" : "Dossier de sauvegarde"}
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {world.isActive ? (
                                        <div className="flex items-center gap-1.5 text-success text-sm font-medium">
                                            <CheckCircle2 size={16} /> Actif
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">Inactif</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        onClick={() => !world.isActive && setActiveWorld(world.name)}
                                        disabled={loading || world.isActive}
                                        variant={world.isActive ? 'outline' : 'primary'}
                                        size="sm"
                                        className={world.isActive ? 'border-success/30 text-success bg-success/10 opacity-100 cursor-default' : ''}
                                    >
                                        {world.isActive ? 'Monde Actuel' : (
                                            <>
                                                <Play size={14} className="mr-1.5" /> Charger
                                            </>
                                        )}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* TODO: Need Improvement */}
            <div className="mt-8 p-4 bg-surface/50 rounded-lg border border-border">
                <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <AlertCircle size={16} className="text-primary" />
                    Comment ça marche ?
                </h4>
                <p className="text-sm text-muted-foreground">
                    Lorsque vous activez un monde, le panel modifie automatiquement le paramètre <code>level-name</code> dans votre fichier <code>server.properties</code> et <strong>redémarre le serveur</strong>. Vos joueurs seront déconnectés pendant le redémarrage.
                </p>
            </div>
        </Card>
    );
};
