import React, { useState, useEffect } from 'react';
import { Settings, Loader2, Folder, ChevronLeft, ChevronRight } from 'lucide-react';
import { useModrinth, ModrinthProject } from '../hooks/useModrinth';
import { useModsStore } from '../store/modsStore';
import { tauriBridge } from '../lib/tauriBridge';
import { ModFilters } from './mods/ModFilters';
import { ModCard } from './mods/ModCard';
import { ModsSettingsModal } from './dialogs/ModsSettingsModal';
import { ClientModWarningModal } from './dialogs/ClientModWarningModal';

interface ModsPanelProps {
    onOpenFiles?: (path: string) => void;
}

export const ModsPanel: React.FC<ModsPanelProps> = ({ onOpenFiles }) => {
    const { searchMods, getLatestVersion, loading, error } = useModrinth();
    const { 
        warnOnClientMods, 
        modPath, 
        modsPerPage: limit,
        lastSelectedVersion: selectedVersion,
        lastSelectedLoader: selectedLoader,
        setLastSelectedVersion: setSelectedVersion,
        setLastSelectedLoader: setSelectedLoader
    } = useModsStore();

    const [searchQuery, setSearchQuery] = useState('');
    
    const [results, setResults] = useState<ModrinthProject[]>([]);
    const [totalHits, setTotalHits] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasSearched, setHasSearched] = useState(false);
    
    const [showSettings, setShowSettings] = useState(false);
    
    const [pendingInstallMod, setPendingInstallMod] = useState<ModrinthProject | null>(null);
    const [installingMods, setInstallingMods] = useState<Set<string>>(new Set());
    const [installedFiles, setInstalledFiles] = useState<string[]>([]);

    const fetchInstalledFiles = async () => {
        try {
            const files = await tauriBridge.sftpListDir(modPath);
            setInstalledFiles(files.map(f => f.name.toLowerCase()));
        } catch (e: any) {
            // Ignore "No such file" error as it just means the directory doesn't exist yet
            if (e && typeof e === 'string' && !e.includes("No such file")) {
                console.error("Failed to fetch installed mods:", e);
            }
            setInstalledFiles([]);
        }
    };

    useEffect(() => {
        fetchInstalledFiles();
    }, [modPath]);

    const handleSearch = async (page = 0) => {
        const res = await searchMods(searchQuery, selectedVersion, selectedLoader, page * limit, limit);
        if (res) {
            setResults(res.hits);
            setTotalHits(res.total_hits);
            setCurrentPage(page);
            setHasSearched(true);
            
            // Scroll back to top of results if we are paginating
            const container = document.getElementById('mods-scroll-container');
            if (container) {
                container.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    };

    // Auto search on mount or when filter changes
    useEffect(() => {
        handleSearch(0);
    }, [selectedVersion, selectedLoader, limit]);

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
            await fetchInstalledFiles(); // Refresh installed mods list
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

    const totalPages = Math.ceil(totalHits / limit);

    const renderPagination = (className: string) => {
        if (results.length === 0 || loading) return null;
        
        return (
            <div className={`flex items-center justify-between p-3 bg-surface/50 rounded-lg border border-border ${className}`}>
                <div className="text-sm text-muted-foreground">
                    Page <span className="font-medium text-foreground">{currentPage + 1}</span> sur <span className="font-medium text-foreground">{totalPages}</span>
                    <span className="opacity-75 ml-1.5">({totalHits} mods)</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleSearch(currentPage - 1)}
                        disabled={currentPage === 0}
                        className="p-1.5 flex items-center gap-1 text-sm font-medium text-foreground bg-surface hover:bg-surface-hover border border-border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={16} />
                        Précédent
                    </button>
                    <button
                        onClick={() => handleSearch(currentPage + 1)}
                        disabled={(currentPage + 1) * limit >= totalHits}
                        className="p-1.5 flex items-center gap-1 text-sm font-medium text-foreground bg-surface hover:bg-surface-hover border border-border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Suivant
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-background text-foreground">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Mods</h2>
                    <p className="text-muted-foreground text-sm">Cherchez et installez des mods via Modrinth.</p>
                </div>
                <div className="flex items-center gap-2">
                    {onOpenFiles && (
                        <button
                            onClick={() => onOpenFiles(modPath)}
                            className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-surface border border-border rounded-md transition-colors"
                            title="Explorer les fichiers"
                        >
                            <Folder size={18} />
                            <span className="text-sm font-medium">Dossier</span>
                        </button>
                    )}
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface border border-border rounded-md transition-colors"
                        title="Paramètres des mods"
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <ModFilters 
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedVersion={selectedVersion}
                setSelectedVersion={setSelectedVersion}
                selectedLoader={selectedLoader}
                setSelectedLoader={setSelectedLoader}
                onSearch={() => handleSearch(0)}
            />

            {error && (
                <div className="mt-4 p-3 bg-danger/10 border border-danger text-danger text-sm rounded-md">
                    {error}
                </div>
            )}

            {/* Pagination Controls (Top) */}
            {renderPagination("mt-4")}

            {/* Results Grid */}
            <div id="mods-scroll-container" className="flex-1 overflow-y-auto mt-4 custom-scrollbar pr-2 pb-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
                        <Loader2 size={32} className="animate-spin text-primary" />
                        <p>Recherche en cours...</p>
                    </div>
                ) : results.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {results.map(mod => {
                            // Robust mod matching logic
                            const slug = mod.slug.toLowerCase();
                            const title = mod.title.toLowerCase();
                            
                            const possibleMatches = Array.from(new Set([
                                slug, // e.g. xaeros-minimap
                                slug.replace(/-/g, ''), // xaerosminimap
                                slug.replace(/-/g, '_'), // xaeros_minimap
                                title.replace(/[^a-z0-9]/g, ''), // xaerosminimap
                                title.replace(/'s/g, '').replace(/[^a-z0-9]/g, ''), // xaerominimap
                                slug.replace(/s-/g, '-') // xaero-minimap
                            ])).filter(m => m.length >= 3);

                            const isInstalled = installedFiles.some(f => 
                                possibleMatches.some(m => f.includes(m))
                            );

                            return (
                                <ModCard 
                                    key={mod.project_id} 
                                    mod={mod} 
                                    onInstall={handleInstallClick}
                                    isInstalling={installingMods.has(mod.project_id)}
                                    isInstalled={isInstalled}
                                />
                            );
                        })}
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

                {/* Pagination Controls (Bottom) */}
                {renderPagination("mt-6 mb-2")}
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
