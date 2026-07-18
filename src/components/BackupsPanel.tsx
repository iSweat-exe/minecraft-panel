import React from 'react';
import { useBackupStore } from '../store/backupStore';
import { Archive, Download, Upload, AlertCircle, Loader2, CheckCircle } from 'lucide-react';

export const BackupsPanel: React.FC = () => {
    const { loading, success, statusText, error, createBackup, restoreBackup, cancelBackup, progress, speed, eta } = useBackupStore();

    const formatETA = (seconds: number) => {
        if (!isFinite(seconds) || seconds < 0) return 'Calcul...';
        if (seconds < 60) return `${Math.ceil(seconds)}s`;
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}m ${s}s`;
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950/50 p-6 rounded-xl border border-zinc-800/50">
            <div className="mb-8">
                <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <Archive className="text-indigo-400" />
                    Sauvegardes (Local)
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                    Sauvegardez le monde actif de votre serveur sur votre ordinateur et restaurez-le si besoin.
                </p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-sm flex items-center gap-3 text-red-400">
                    <AlertCircle size={20} className="shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Save block */}
                <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col items-center text-center">
                    <div className="w-16 h-16 flex items-center justify-center mb-4 text-indigo-400">
                        <Download size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-100 mb-2">Créer une Sauvegarde</h3>
                    <p className="text-sm text-zinc-400 mb-6">
                        Compresse le monde actif du serveur et le télécharge sur votre PC. 
                    </p>
                    <button
                        onClick={createBackup}
                        disabled={loading}
                        className="mt-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-sm font-medium transition-colors w-full justify-center flex items-center gap-2"
                    >
                        <Download size={16} />
                        Sauvegarder
                    </button>
                </div>

                {/* Restore block */}
                <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 flex flex-col items-center text-center">
                    <div className="w-16 h-16 flex items-center justify-center mb-4 text-amber-400">
                        <Upload size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-100 mb-2">Restaurer un Monde</h3>
                    <p className="text-sm text-zinc-400 mb-6">
                        Envoyez une archive <code>.tar.gz</code> pour écraser et restaurer un monde.
                        <br/><span className="text-amber-500/80 text-xs">Le serveur s'arrêtera automatiquement.</span>
                    </p>
                    <button
                        onClick={restoreBackup}
                        disabled={loading}
                        className="mt-auto px-6 py-2.5 bg-amber-600/80 hover:bg-amber-600/70 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-sm font-medium transition-colors flex items-center gap-2 w-full justify-center"
                    >
                        <Upload size={16}/>
                        Restaurer
                    </button>
                </div>
            </div>

            {/* Status & Progress indicator */}
            {(loading || success) && (
                <div className={`mt-8 p-6 bg-zinc-900 border ${success ? 'border-emerald-500/50' : 'border-zinc-800'} rounded-xl shadow-lg transition-colors duration-500`}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            {success ? (
                                <CheckCircle className="text-emerald-500" size={24} />
                            ) : (
                                <Loader2 className="animate-spin text-indigo-400" size={24} />
                            )}
                            <span className={`font-medium text-lg ${success ? 'text-emerald-400' : 'text-zinc-100'}`}>
                                {statusText || 'Opération en cours...'}
                            </span>
                        </div>
                        
                        {!success && (
                            <button
                                onClick={cancelBackup}
                                className="px-4 py-2 bg-red-500/0 hover:bg-red-500/10 text-red-400/70 text-sm font-medium rounded-sm transition-colors"
                            >
                                Annuler
                            </button>
                        )}
                    </div>

                    {progress && progress.total > 0 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-end">
                                <span className={`text-sm font-medium truncate pr-4 ${success ? 'text-emerald-400/80' : 'text-zinc-300'}`}>
                                    {progress.filename}
                                </span>
                                <span className={`text-sm font-bold ${success ? 'text-emerald-400' : 'text-indigo-400'}`}>
                                    {Math.round((progress.written / progress.total) * 100)}%
                                </span>
                            </div>

                            <div className={`h-2.5 rounded-full overflow-hidden ${success ? 'bg-emerald-950' : 'bg-zinc-800'}`}>
                                <div 
                                    className={`h-full transition-all duration-300 ${success ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${(progress.written / progress.total) * 100}%` }}
                                />
                            </div>

                            <div className="flex justify-between items-center text-xs text-zinc-400 font-medium mt-1">
                                <div className="flex items-center gap-3">
                                    <span className="text-zinc-500">
                                        {(speed / 1024 / 1024).toFixed(1)} MB/s
                                    </span>
                                    {!success && speed > 0 && (
                                        <span className="text-zinc-500">
                                            ETA: {formatETA(eta)}
                                        </span>
                                    )}
                                </div>
                                <span className={`tabular-nums ${success ? 'text-emerald-400/70' : ''}`}>
                                    {(progress.written / 1024 / 1024).toFixed(1)} MB / {(progress.total / 1024 / 1024).toFixed(1)} MB
                                </span>
                            </div>
                        </div>
                    )}
                    
                    {(!progress || progress.total === 0) && statusText.includes('Téléchargement') && (
                        <div className="text-sm text-zinc-500 animate-pulse">Préparation du transfert...</div>
                    )}
                </div>
            )}
            
            {/* TODO: Review this later */}
            {/* {(!loading && !success) && statusText && (
                <div className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-center font-medium">
                    {statusText}
                </div>
            )} */}
        </div>
    );
};

