import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { ModrinthProject } from '../../hooks/useModrinth';

interface ClientModWarningModalProps {
    mod: ModrinthProject;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ClientModWarningModal: React.FC<ClientModWarningModalProps> = ({ mod, onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-md flex flex-col overflow-hidden">
                <div className="p-6 flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center text-warning">
                        <TriangleAlert size={24} />
                    </div>
                    
                    <h2 className="text-xl font-semibold text-foreground">Mod Côté Client Détecté</h2>
                    
                    <p className="text-sm text-muted-foreground">
                        Le mod <strong>{mod.title}</strong> est indiqué comme n'étant pas requis sur le serveur, 
                        ou est explicitement marqué comme un mod "Côté Client" (Client-side).
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Installer des mods client sur un serveur peut causer des crashs ou être inutile. Êtes-vous sûr de vouloir l'installer ?
                    </p>
                </div>

                <div className="p-4 border-t border-border flex justify-end gap-3 bg-background/50">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface rounded-md transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm font-medium text-warning-foreground bg-warning hover:bg-warning/90 rounded-md transition-colors"
                    >
                        Installer quand même
                    </button>
                </div>
            </div>
        </div>
    );
};
