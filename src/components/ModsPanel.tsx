import React, { useState, useEffect } from 'react';
import { Settings, Loader2 } from 'lucide-react';
import { useModrinth, ModrinthProject } from '../hooks/useModrinth';
import { useModsStore } from '../store/modsStore';
import { tauriBridge } from '../lib/tauriBridge';
import { ModFilters } from './mods/ModFilters';
import { ModCard } from './mods/ModCard';
import { ModsSettingsModal } from './dialogs/ModsSettingsModal';
import { ClientModWarningModal } from './dialogs/ClientModWarningModal';

export const ModsPanel: React.FC = () => {
    const { searchMods, getLatestVersion, loading, error } = useModrinth();
    const { warnOnClientMods, modPath } = useModsStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedVersion, setSelectedVersion] = useState('all');
    const [selectedLoader, setSelectedLoader] = useState('all');
    
    const [results, setResults] = useState<ModrinthProject[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    
    const [showSettings, setShowSettings] = useState(false);
    
    const [pendingInstallMod, setPendingInstallMod] = useState<ModrinthProject | null>(null);
    const [installingMods, setInstallingMods] = useState<Set<string>>(new Set());

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        const res = await searchMods(searchQuery, selectedVersion, selectedLoader);
        if (res) {
            setResults(res.hits);
            setHasSearched(true);
        }
    };

    // Auto search on enter or when filter changes
    useEffect(() => {
        if (hasSearched) handleSearch();
    }, [selectedVersion, selectedLoader]);

    const handleInstallClick = (mod: ModrinthProject) => {
        // Check if it's a client-side only mod or unsupported on server
        if (warnOnClientMods && (mod.server_side === 'unsupported' || (mod.client_side === 'required' && mod.server_side === 'optional'))) {
            setPendingInstallMod(mod);
        } else {
            executeInstall(mod);
        }
    };

    const executeInstall = async (mod: ModrinthProject) => {
        setPendingInstallMod(null);
        setInstallingMods(prev => new Set(prev).add(mod.project_id));
        
        try {
            // 1. Fetch latest version
            const latest = await getLatestVersion(mod.project_id, selectedVersion, selectedLoader);
            if (!latest || !latest.files || latest.files.length === 0) {
                alert(`Aucune version compatible trouvée pour ${mod.title}`);
                return;
            }

            // Get primary file or first file
            const file = latest.files.find(f => f.primary) || latest.files[0];
            
            // 2. Download to server
            // Mod path could be relative like ~/minecraft/mods or absolute
            const finalPath = modPath.endsWith('/') ? `${modPath}${file.filename}` : `${modPath}/${file.filename}`;
            
            await tauriBridge.sshDownloadRemote(file.url, finalPath);
            // Optionally could trigger a refresh or toast here
        } catch (e: any) {
            console.error("Install error:", e);
            alert(`Erreur d'installation: ${e.message}`);
        } finally {
            setInstallingMods(prev => {
                const newSet = new Set(prev);
                newSet.delete(mod.project_id);
                return newSet;
            });
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-background text-foreground">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Mods</h2>
                    <p className="text-muted-foreground text-sm">Cherchez et installez des mods via Modrinth.</p>
                </div>
                <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface border border-border rounded-md transition-colors"
                    title="Paramètres des mods"
                >
                    <Settings size={20} />
                </button>
            </div>

            {/* Filters */}
            <ModFilters 
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedVersion={selectedVersion}
                setSelectedVersion={setSelectedVersion}
                selectedLoader={selectedLoader}
                setSelectedLoader={setSelectedLoader}
                onSearch={handleSearch}
            />

            {error && (
                <div className="mt-4 p-3 bg-danger/10 border border-danger text-danger text-sm rounded-md">
                    {error}
                </div>
            )}

            {/* Results Grid */}
            <div className="flex-1 overflow-y-auto mt-4 custom-scrollbar pr-2 pb-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
                        <Loader2 size={32} className="animate-spin text-primary" />
                        <p>Recherche en cours...</p>
                    </div>
                ) : results.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {results.map(mod => (
                            <ModCard 
                                key={mod.project_id} 
                                mod={mod} 
                                onInstall={handleInstallClick}
                                isInstalling={installingMods.has(mod.project_id)}
                            />
                        ))}
                    </div>
                ) : hasSearched ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <p>Aucun mod trouvé pour cette recherche.</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <p>Utilisez la barre de recherche pour trouver des mods.</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showSettings && (
                <ModsSettingsModal onClose={() => setShowSettings(false)} />
            )}
            
            {pendingInstallMod && (
                <ClientModWarningModal 
                    mod={pendingInstallMod}
                    onConfirm={() => executeInstall(pendingInstallMod)}
                    onCancel={() => setPendingInstallMod(null)}
                />
            )}
        </div>
    );
};
