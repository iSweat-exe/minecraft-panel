import React from 'react';
import { useWorlds } from '../hooks/useWorlds';
import { Globe, AlertCircle, RefreshCw, CheckCircle2, Play } from 'lucide-react';

export const WorldsPanel: React.FC = () => {
    const { worlds, loading, error, setActiveWorld, fetchWorlds } = useWorlds();

    return (
        <div className="flex flex-col h-full bg-zinc-950/50 p-6 rounded-xl border border-zinc-800/50">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                        <Globe className="text-indigo-400" />
                        Gestion des Mondes
                    </h2>
                    <p className="text-sm text-zinc-400 mt-1">
                        Sélectionnez le monde actif pour le serveur.
                    </p>
                </div>
                <button
                    onClick={fetchWorlds}
                    disabled={loading}
                    className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                    <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
                    <AlertCircle size={20} className="shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {/* TODO: Need Review */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {worlds.map(world => (
                    <div
                        key={world.name}
                        className={`group flex flex-col p-5 rounded-lg border backdrop-blur-sm transition-all duration-300 ${world.isActive
                                ? 'border-emerald-500/30'
                                : 'border-zinc-800/60 hover:bg-zinc-900/60 hover:border-indigo-500/30 hover:-translate-y-1'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className={`${world.isActive ? 'text-emerald-400' : 'bg-zinc-800 text-zinc-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-colors'
                                }`}>
                                <Globe size={28} />
                            </div>

                            {/* Status Badge */}
                            {world.isActive ? (
                                <CheckCircle2 size={20} className="text-emerald-400" />
                            ) : (
                                <></>
                            )}
                        </div>

                        <div className="flex-1 mb-3">
                            <h3 className="text-xl font-bold text-zinc-100 truncate mb-2">{world.name}</h3>
                            <p className="text-sm text-zinc-500 line-clamp-2">
                                Dossier de sauvegarde du monde. {world.isActive ? "Le serveur tourne actuellement sur ce monde." : "Prêt à être chargé sur le serveur."}
                            </p>
                        </div>

                        <button
                            onClick={() => !world.isActive && setActiveWorld(world.name)}
                            disabled={loading || world.isActive}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-sm font-semibold transition-all duration-300 ${world.isActive
                                    ? 'bg-emerald-500/10 text-emerald-400 cursor-default'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-indigo-600 hover:text-white'
                                }`}
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
                        </button>
                    </div>
                ))}

                {worlds.length === 0 && !loading && (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center text-zinc-500 bg-zinc-900/30 rounded-2xl border border-zinc-800/50 border-dashed">
                        <Globe size={48} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium text-zinc-400 mb-1">Aucun monde trouvé.</p>
                        <p className="text-sm">Assurez-vous qu'il y a des dossiers avec 'level.dat' dans /minecraft</p>
                    </div>
                )}
            </div>

            {/* TODO: Need Improvement */}
            <div className="mt-8 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <h4 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                    <AlertCircle size={16} className="text-indigo-400" />
                    Comment ça marche ?
                </h4>
                <p className="text-sm text-zinc-500">
                    Lorsque vous activez un monde, le panel modifie automatiquement le paramètre <code>level-name</code> dans votre fichier <code>server.properties</code> et <strong>redémarre le serveur</strong>. Vos joueurs seront déconnectés pendant le redémarrage.
                </p>
            </div>
        </div>
    );
};
