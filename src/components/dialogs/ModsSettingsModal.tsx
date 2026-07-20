import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useModsStore } from '../../store/modsStore';

interface ModsSettingsModalProps {
    onClose: () => void;
}

export const ModsSettingsModal: React.FC<ModsSettingsModalProps> = ({ onClose }) => {
    const { 
        modPath, 
        curseforgeApiKey, 
        warnOnClientMods, 
        setModPath, 
        setCurseforgeApiKey, 
        setWarnOnClientMods 
    } = useModsStore();

    const [tempPath, setTempPath] = useState(modPath);
    const [tempKey, setTempKey] = useState(curseforgeApiKey);
    const [tempWarn, setTempWarn] = useState(warnOnClientMods);

    const handleSave = () => {
        setModPath(tempPath);
        setCurseforgeApiKey(tempKey);
        setWarnOnClientMods(tempWarn);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-lg flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">Paramètres des Mods</h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-foreground">Dossier d'installation des mods</label>
                        <input 
                            type="text" 
                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                            value={tempPath}
                            onChange={(e) => setTempPath(e.target.value)}
                            placeholder="ex: ~/minecraft/mods/"
                        />
                        <p className="text-xs text-muted-foreground">Chemin relatif depuis le dossier personnel ou chemin absolu sur le serveur distant.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-foreground">Clé API CurseForge (Optionnel)</label>
                        <input 
                            type="password" 
                            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                            value={tempKey}
                            onChange={(e) => setTempKey(e.target.value)}
                            placeholder="Votre clé API CurseForge..."
                        />
                        <p className="text-xs text-muted-foreground">Requis uniquement si vous souhaitez utiliser le catalogue CurseForge dans le futur.</p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">Alerte mods côté client</span>
                            <span className="text-xs text-muted-foreground">Avertir avant d'installer un mod qui est uniquement conçu pour le client (joueur).</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={tempWarn}
                                onChange={(e) => setTempWarn(e.target.checked)}
                            />
                            <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                </div>

                <div className="p-4 border-t border-border flex justify-end gap-3 bg-surface/50 rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary-hover rounded-md transition-colors flex items-center gap-2"
                    >
                        <Save size={16} />
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
    );
};
