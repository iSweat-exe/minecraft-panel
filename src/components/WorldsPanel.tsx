import React from 'react';
import { useWorlds } from '../hooks/useWorlds';
import { Globe, AlertCircle, RefreshCw, CheckCircle2, Play } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

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

            {/* TODO: Need Review */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {worlds.map(world => (
                    <Card
                        key={world.name}
                        className={`group flex flex-col p-5 border backdrop-blur-sm transition-all duration-300 ${world.isActive
                                ? 'border-success/30 bg-success/5'
                                : 'hover:bg-surface-hover hover:border-primary/30 hover:-translate-y-1'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className={`${world.isActive ? 'text-success' : 'bg-surface text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors'
                                } p-2 rounded-lg`}>
                                <Globe size={28} />
                            </div>

                            {/* Status Badge */}
                            {world.isActive && (
                                <CheckCircle2 size={20} className="text-success" />
                            )}
                        </div>

                        <div className="flex-1 mb-3">
                            <h3 className="text-xl font-bold text-foreground truncate mb-2">{world.name}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                Dossier de sauvegarde du monde. {world.isActive ? "Le serveur tourne actuellement sur ce monde." : "Prêt à être chargé sur le serveur."}
                            </p>
                        </div>

                        <Button
                            onClick={() => !world.isActive && setActiveWorld(world.name)}
                            disabled={loading || world.isActive}
                            variant={world.isActive ? 'outline' : 'primary'}
                            className={`w-full flex items-center justify-center gap-2 ${world.isActive ? 'border-success/30 text-success bg-success/10 opacity-100' : ''}`}
                        >
                            {world.isActive ? (
                                <>
                                    Monde Actuel
                                </>
                            ) : (
                                <>
                                    <Play size={18} />
                                    Charger ce monde
                                </>
                            )}
                        </Button>
                    </Card>
                ))}

                {worlds.length === 0 && !loading && (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center text-muted-foreground bg-surface/30 rounded-2xl border border-border/50 border-dashed">
                        <Globe size={48} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium text-muted-foreground mb-1">Aucun monde trouvé.</p>
                        <p className="text-sm">Assurez-vous qu'il y a des dossiers avec 'level.dat' dans /minecraft</p>
                    </div>
                )}
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
