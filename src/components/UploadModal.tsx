import React from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Upload, RefreshCw, SkipForward, Undo2 } from 'lucide-react';

export type UploadFileStatus = 'pending' | 'uploading' | 'done' | 'error' | 'cancelled' | 'conflict';

export interface UploadFileItem {
    filename: string;
    localPath: string;
    remotePath: string;
    status: UploadFileStatus;
    progress: number; // 0-100
    error?: string;
}

interface UploadModalProps {
    files: UploadFileItem[];
    onCancel: (index: number) => void;
    onResolveConflict: (index: number, action: 'replace' | 'skip') => void;
    onUndoCancel: (index: number) => void;
    onContinue: () => void;
}

const StatusIcon: React.FC<{ status: UploadFileStatus }> = ({ status }) => {
    switch (status) {
        case 'pending':
            return <div className="w-4 h-4 rounded-full border-2 border-zinc-600" />;
        case 'uploading':
            return <Loader2 size={16} className="text-indigo-400 animate-spin" />;
        case 'done':
            return <CheckCircle2 size={16} className="text-emerald-400" />;
        case 'error':
            return <AlertCircle size={16} className="text-red-400" />;
        case 'cancelled':
            return <X size={16} className="text-zinc-500" />;
        case 'conflict':
            return <AlertCircle size={16} className="text-amber-400" />;
    }
};

export const UploadModal: React.FC<UploadModalProps> = ({ files, onCancel, onResolveConflict, onUndoCancel, onContinue }) => {
    const isSettled = (s: UploadFileStatus) => s === 'done' || s === 'error' || s === 'cancelled';
    const allDone = files.every(f => isSettled(f.status));
    const hasConflicts = files.some(f => f.status === 'conflict');
    const doneCount = files.filter(f => f.status === 'done').length;
    const totalCount = files.length;

    const getSubtitle = () => {
        if (hasConflicts) {
            const conflictCount = files.filter(f => f.status === 'conflict').length;
            return `${conflictCount} fichier${conflictCount > 1 ? 's' : ''} existe${conflictCount > 1 ? 'nt' : ''} déjà`;
        }
        if (allDone) {
            return `${doneCount}/${totalCount} fichier${totalCount > 1 ? 's' : ''} uploadé${doneCount > 1 ? 's' : ''}`;
        }
        return `Upload de ${totalCount} fichier${totalCount > 1 ? 's' : ''}…`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg border ${
                            hasConflicts
                                ? 'bg-amber-500/10 border-amber-500/20'
                                : 'bg-indigo-500/10 border-indigo-500/20'
                        }`}>
                            <Upload size={20} className={hasConflicts ? 'text-amber-400' : 'text-indigo-400'} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-100">
                                {hasConflicts ? 'Conflits détectés' : 'Upload en cours'}
                            </h2>
                            <p className="text-xs text-zinc-500 mt-0.5">{getSubtitle()}</p>
                        </div>
                    </div>
                </div>

                {/* File list */}
                <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
                    {files.map((file, index) => (
                        <div
                            key={file.localPath}
                            className={`px-5 py-3 border-b border-zinc-800/50 last:border-b-0 transition-colors ${
                                file.status === 'cancelled' ? 'opacity-40' : ''
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <StatusIcon status={file.status} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-zinc-200 font-medium truncate">{file.filename}</p>
                                        {file.status === 'conflict' && (
                                            <p className="text-[11px] text-amber-400/80 mt-0.5">Ce fichier existe déjà sur le serveur</p>
                                        )}
                                        {file.error && (
                                            <p className="text-[11px] text-red-400 mt-0.5 truncate">{file.error}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Conflict actions */}
                                {file.status === 'conflict' && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => onResolveConflict(index, 'replace')}
                                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-md transition-colors"
                                            title="Remplacer le fichier existant"
                                        >
                                            <RefreshCw size={11} />
                                            Remplacer
                                        </button>
                                        <button
                                            onClick={() => onResolveConflict(index, 'skip')}
                                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors"
                                            title="Ignorer ce fichier"
                                        >
                                            <SkipForward size={11} />
                                            Passer
                                        </button>
                                    </div>
                                )}

                                {/* Cancel button for pending/uploading */}
                                {(file.status === 'pending' || file.status === 'uploading') && (
                                    <button
                                        onClick={() => onCancel(index)}
                                        className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors shrink-0"
                                        title="Annuler"
                                    >
                                        <X size={14} />
                                    </button>
                                )}

                                {/* Undo button for cancelled files */}
                                {file.status === 'cancelled' && (
                                    <button
                                        onClick={() => onUndoCancel(index)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700 rounded-md transition-colors shrink-0"
                                        title="Annuler l'ignorance et reconsidérer"
                                    >
                                        <Undo2 size={11} />
                                        Annuler
                                    </button>
                                )}
                            </div>

                            {/* Progress bar */}
                            {(file.status === 'uploading' || file.status === 'done') && (
                                <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-300 ease-out ${
                                            file.status === 'done'
                                                ? 'bg-emerald-500'
                                                : 'bg-indigo-500'
                                        }`}
                                        style={{ width: `${file.progress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 flex justify-end">
                    <button
                        onClick={onContinue}
                        disabled={!allDone || hasConflicts}
                        className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                            allDone && !hasConflicts
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        }`}
                    >
                        Continuer
                    </button>
                </div>
            </div>
        </div>
    );
};
