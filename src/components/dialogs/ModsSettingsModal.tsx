import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useModsStore } from '../../store/modsStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';

interface ModsSettingsModalProps {
    onClose: () => void;
}

export const ModsSettingsModal: React.FC<ModsSettingsModalProps> = ({ onClose }) => {
    const { 
        modPath, 
        curseforgeApiKey, 
        warnOnClientMods, 
        modsPerPage,
        setModPath, 
        setCurseforgeApiKey, 
        setWarnOnClientMods,
        setModsPerPage
    } = useModsStore();

    const [tempPath, setTempPath] = useState(modPath);
    const [tempKey, setTempKey] = useState(curseforgeApiKey);
    const [tempWarn, setTempWarn] = useState(warnOnClientMods);
    const [tempLimit, setTempLimit] = useState(modsPerPage.toString());

    const handleSave = () => {
        setModPath(tempPath);
        setCurseforgeApiKey(tempKey);
        setWarnOnClientMods(tempWarn);
        
        const parsedLimit = parseInt(tempLimit, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
            setModsPerPage(parsedLimit);
        }
        
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-border bg-surface/50">
                    <h2 className="text-lg font-semibold text-foreground">Paramètres des Mods</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-lg transition-all group"
                        title="Fermer"
                    >
                        <X size={18} className="transition-transform duration-300 group-hover:rotate-180" />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-foreground">Dossier d'installation des mods</label>
                        <Input 
                            type="text" 
                            value={tempPath}
                            onChange={(e) => setTempPath(e.target.value)}
                            placeholder="ex: mods/"
                        />
                        <p className="text-xs text-muted-foreground">Chemin relatif depuis le dossier personnel ou chemin absolu sur le serveur distant.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-foreground">Clé API CurseForge (Optionnel)</label>
                        <Input 
                            type="password" 
                            value={tempKey}
                            onChange={(e) => setTempKey(e.target.value)}
                            placeholder="Votre clé API CurseForge..."
                        />
                        <p className="text-xs text-muted-foreground">Requis uniquement si vous souhaitez utiliser le catalogue CurseForge dans le futur.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-foreground">Nombre de mods par page</label>
                        <Input 
                            type="number"
                            min="1"
                            max="100"
                            value={tempLimit}
                            onChange={(e) => setTempLimit(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Détermine le nombre de résultats affichés par page (défaut : 15).</p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">Alerte mods côté client</span>
                            <span className="text-xs text-muted-foreground">Avertir avant d'installer un mod qui est uniquement conçu pour le client (joueur).</span>
                        </div>
                        <Switch 
                            checked={tempWarn}
                            onChange={(e) => setTempWarn(e.target.checked)}
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-border flex justify-end gap-3 bg-surface/50">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                    >
                        Annuler
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        className="gap-2"
                    >
                        <Save size={16} />
                        Enregistrer
                    </Button>
                </div>
            </div>
        </div>
    );
};
