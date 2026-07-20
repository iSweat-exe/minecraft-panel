import React from 'react';
import { AlertTriangle, Package } from 'lucide-react';
import { ModrinthProject } from '../../hooks/useModrinth';

interface ClientModWarningModalProps {
    mod: ModrinthProject;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ClientModWarningModal: React.FC<ClientModWarningModalProps> = ({ mod, onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 flex flex-col gap-5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center shrink-0 border border-warning/20">
                            <AlertTriangle className="text-warning" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground tracking-tight">Attention</h2>
                            <p className="text-sm text-warning mt-0.5 font-medium">Mod côté client</p>
                        </div>
                    </div>
                    
                    <div className="bg-background rounded-lg p-3 border border-border flex items-center gap-3">
                        {mod.icon_url ? (
                            <img src={mod.icon_url} alt="" className="w-10 h-10 rounded-md shrink-0" />
                        ) : (
                            <div className="w-10 h-10 rounded-md bg-surface flex items-center justify-center shrink-0">
                                <Package size={20} className="text-muted-foreground" />
                            </div>
                        )}
                        <div className="overflow-hidden">
                            <div className="font-semibold text-foreground truncate">{mod.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{mod.description}</div>
                        </div>
                    </div>
                    
                    <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                        <p>
                            Ce mod est indiqué comme n'étant <strong>pas requis</strong> sur le serveur, 
                            ou est explicitement marqué comme un mod <strong>côté client</strong>.
                        </p>
                        <div className="flex items-start gap-2.5 pt-1 text-muted-foreground">
                            <span>L'installation de mods clients sur un serveur peut causer des crashs instantanés au démarrage.</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-border flex justify-end gap-3 bg-background/50">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-foreground hover:bg-surface border border-border rounded-lg transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-bold text-black bg-warning hover:bg-warning/90 rounded-lg transition-colors shadow-sm"
                    >
                        Installer quand même
                    </button>
                </div>
            </div>
        </div>
    );
};
