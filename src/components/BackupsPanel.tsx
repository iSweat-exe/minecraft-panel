import React from 'react';
import { useBackupStore } from '../store/backupStore';
import { Archive, Download, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';

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
        <Card className="flex flex-col h-full bg-background/50 p-6 border-border/50 shadow-none">
            <div className="mb-8">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Archive className="text-primary" />
                    Sauvegardes (Local)
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Sauvegardez le monde actif de votre serveur sur votre ordinateur et restaurez-le si besoin.
                </p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-sm flex items-center gap-3 text-danger">
                    <AlertCircle size={20} className="shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Save block */}
                <Card className="p-6 bg-surface/50 flex flex-col items-center text-center">
                    <div className="w-16 h-16 flex items-center justify-center mb-4 text-primary">
                        <Download size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Créer une Sauvegarde</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                        Compresse le monde actif du serveur et le télécharge sur votre PC. 
                    </p>
                    <Button
                        onClick={createBackup}
                        disabled={loading}
                        className="mt-auto w-full flex items-center gap-2 justify-center"
                    >
                        <Download size={16} />
                        Sauvegarder
                    </Button>
                </Card>

                {/* Restore block */}
                <Card className="p-6 bg-surface/50 flex flex-col items-center text-center">
                    <div className="w-16 h-16 flex items-center justify-center mb-4 text-warning">
                        <Upload size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Restaurer un Monde</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                        Envoyez une archive <code>.tar.gz</code> pour écraser et restaurer un monde.
                        <br/><span className="text-warning/80 text-xs">Le serveur s'arrêtera automatiquement.</span>
                    </p>
                    <Button
                        onClick={restoreBackup}
                        disabled={loading}
                        className="mt-auto w-full flex items-center gap-2 justify-center bg-warning/80 hover:bg-warning text-warning-foreground"
                    >
                        <Upload size={16}/>
                        Restaurer
                    </Button>
                </Card>
            </div>

            {/* Status & Progress indicator */}
            {(loading || success) && (
                <Card className={`mt-8 p-6 bg-surface ${success ? 'border-success/50' : ''} transition-colors duration-500`}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            {success ? (
                                <CheckCircle className="text-success" size={24} />
                            ) : (
                                <Spinner className="text-primary" size={24} />
                            )}
                            <span className={`font-medium text-lg ${success ? 'text-success' : 'text-foreground'}`}>
                                {statusText || 'Opération en cours...'}
                            </span>
                        </div>
                        
                        {!success && (
                            <Button
                                onClick={cancelBackup}
                                variant="ghost"
                                className="text-danger/70 hover:text-danger hover:bg-danger/10"
                            >
                                Annuler
                            </Button>
                        )}
                    </div>

                    {progress && progress.total > 0 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-end">
                                <span className={`text-sm font-medium truncate pr-4 ${success ? 'text-success/80' : 'text-foreground/80'}`}>
                                    {progress.filename}
                                </span>
                                <span className={`text-sm font-bold ${success ? 'text-success' : 'text-primary'}`}>
                                    {Math.round((progress.written / progress.total) * 100)}%
                                </span>
                            </div>

                            <div className={`h-2.5 rounded-full overflow-hidden ${success ? 'bg-success/20' : 'bg-surface-hover'}`}>
                                <div 
                                    className={`h-full transition-all duration-300 ${success ? 'bg-success' : 'bg-primary'}`}
                                    style={{ width: `${(progress.written / progress.total) * 100}%` }}
                                />
                            </div>

                            <div className="flex justify-between items-center text-xs text-muted-foreground font-medium mt-1">
                                <div className="flex items-center gap-3">
                                    <span className="text-muted-foreground/80">
                                        {(speed / 1024 / 1024).toFixed(1)} MB/s
                                    </span>
                                    {!success && speed > 0 && (
                                        <span className="text-muted-foreground/80">
                                            ETA: {formatETA(eta)}
                                        </span>
                                    )}
                                </div>
                                <span className={`tabular-nums ${success ? 'text-success/70' : ''}`}>
                                    {(progress.written / 1024 / 1024).toFixed(1)} MB / {(progress.total / 1024 / 1024).toFixed(1)} MB
                                </span>
                            </div>
                        </div>
                    )}
                    
                    {(!progress || progress.total === 0) && statusText.includes('Téléchargement') && (
                        <div className="text-sm text-muted-foreground animate-pulse">Préparation du transfert...</div>
                    )}
                </Card>
            )}
            
            {/* TODO: Review this later */}
            {/* {(!loading && !success) && statusText && (
                <div className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-center font-medium">
                    {statusText}
                </div>
            )} */}
        </Card>
    );
};

