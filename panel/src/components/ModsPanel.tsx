import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, Loader2, Folder, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearchModsQuery, fetchLatestVersion } from '../api/modrinth';
import type { ModrinthProject } from '../api/modrinth';
import { useModsStore } from '../store/modsStore';
import { tauriBridge } from '../lib/tauriBridge';
import { ModFilters } from './mods/ModFilters';
import { ModCard } from './mods/ModCard';
import { ModsSettingsModal } from './dialogs/ModsSettingsModal';
import { ClientModWarningModal } from './dialogs/ClientModWarningModal';
import { ModDetailsModal } from './dialogs/ModDetailsModal';
import type { ModrinthVersion } from '../api/modrinth';
import { logAction } from '../lib/actionLogger';

export const ModsPanel: React.FC = () => {
    const navigate = useNavigate();
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
    const [currentPage, setCurrentPage] = useState(0);
    const [hasSearched, setHasSearched] = useState(false);
    
    // Mod Details Modal
    const [selectedModDetails, setSelectedModDetails] = useState<ModrinthProject | null>(null);
    
    // React Query
    const { data, isLoading: loading, error } = useSearchModsQuery(
        searchQuery,
        selectedVersion,
        selectedLoader,
        currentPage * limit,
        limit
    );

    const results = data?.hits || [];
    const totalHits = data?.total_hits || 0;
    
    const [showSettings, setShowSettings] = useState(false);
    
    const [pendingInstallMod, setPendingInstallMod] = useState<ModrinthProject | null>(null);
    const [installingMods, setInstallingMods] = useState<Set<string>>(new Set());
    const [installedFiles, setInstalledFiles] = useState<string[]>([]);
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const getResolvedModPath = (rawPath: string): string => {
        const trimmed = (rawPath || '').trim();
        if (!trimmed || trimmed === 'mods' || trimmed === 'mods/' || trimmed === './mods' || trimmed === './mods/') {
            return '/minecraft/mods';
        }
        if (trimmed.startsWith('/')) return trimmed;
        if (trimmed.startsWith('~/')) return trimmed;
        return `/minecraft/${trimmed.replace(/^\.\//, '')}`;
    };

    const fetchInstalledFiles = async () => {
        try {
            const resolvedPath = getResolvedModPath(modPath);
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            if (!host || !token) return;
            const nodeUrl = `http://${host}:${port}`;

            await tauriBridge.nodeFileAction(nodeUrl, token, resolvedPath, { action: { mkdir: {} } }).catch(() => {});
            const files = await tauriBridge.nodeListDir(nodeUrl, token, resolvedPath);
            setInstalledFiles(files.map(f => f.name.toLowerCase()));
        } catch (e: any) {
            if (e && typeof e === 'string' && !e.includes("No such file")) {
                console.error("Failed to fetch installed mods:", e);
            }
            setInstalledFiles([]);
        }
    };

    useEffect(() => {
        fetchInstalledFiles();
    }, [modPath]);

    const handleSearch = (page = 0) => {
        setCurrentPage(page);
        setHasSearched(true);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        setCurrentPage(0);
    }, [selectedVersion, selectedLoader, limit, searchQuery]);

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
            const latest = await fetchLatestVersion(mod.project_id, selectedVersion, selectedLoader);
            if (!latest || !latest.files || latest.files.length === 0) {
                alert(`Aucune version compatible trouvée pour ${mod.title}`);
                return;
            }

            // Get primary file or first file
            const file = latest.files.find(f => f.primary) || latest.files[0];
            
            // 2. Download to server
            const resolvedDir = getResolvedModPath(modPath);
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            if (!host || !token) throw new Error("Daemon credentials missing");
            const nodeUrl = `http://${host}:${port}`;

            await tauriBridge.nodeFileAction(nodeUrl, token, resolvedDir, { action: { mkdir: {} } }).catch(() => {});
            const finalPath = resolvedDir.endsWith('/') ? `${resolvedDir}${file.filename}` : `${resolvedDir}/${file.filename}`;
            
            await tauriBridge.nodeDownloadRemote(nodeUrl, token, file.url, finalPath);
            await fetchInstalledFiles(); // Refresh installed mods list
            
            logAction('Installation d\'un mod', { mod: mod.title, version: latest.version_number, file: file.filename });
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

    const executeInstallSpecificVersion = async (version: ModrinthVersion) => {
        if (!selectedModDetails) return;
        const primaryFile = version.files.find(f => f.primary) || version.files[0];
        if (!primaryFile) return;

        const modId = selectedModDetails.project_id;
        setInstallingMods(prev => new Set(prev).add(modId));

        try {
            const resolvedPath = getResolvedModPath(modPath);
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            if (!host || !token) throw new Error("Daemon credentials missing");
            const nodeUrl = `http://${host}:${port}`;

            await tauriBridge.nodeFileAction(nodeUrl, token, resolvedPath, { action: { mkdir: {} } }).catch(() => {});
            await tauriBridge.nodeDownloadRemote(nodeUrl, token, primaryFile.url, `${resolvedPath}/${primaryFile.filename}`);
            logAction('INSTALL_MOD', `Installed ${selectedModDetails.title} version ${version.version_number}`);
            await fetchInstalledFiles();
        } catch (e: any) {
            alert(`Erreur d'installation de la version: ${e?.message || e}`);
        } finally {
            setInstallingMods(prev => {
                const next = new Set(prev);
                next.delete(modId);
                return next;
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
                        className="px-3 py-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground bg-surface hover:bg-surface-hover border border-border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={16} />
                        Précédent
                    </button>
                    <button
                        onClick={() => handleSearch(currentPage + 1)}
                        disabled={(currentPage + 1) * limit >= totalHits}
                        className="px-3 py-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground bg-surface hover:bg-surface-hover border border-border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Suivant
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        );
    };

    const processedResults = useMemo(() => {
        return results.map(mod => {
            const slug = mod.slug.toLowerCase();
            const title = mod.title.toLowerCase();
            
            const possibleMatches = Array.from(new Set([
                slug,
                slug.replace(/-/g, ''),
                slug.replace(/-/g, '_'),
                title.replace(/[^a-z0-9]/g, ''),
                title.replace(/'s/g, '').replace(/[^a-z0-9]/g, ''),
                slug.replace(/s-/g, '-')
            ])).filter(m => m.length >= 3);

            const isInstalled = installedFiles.some(f => 
                possibleMatches.some(m => f.includes(m))
            );

            return { ...mod, isInstalled };
        });
    }, [results, installedFiles]);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-background text-foreground">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Mods</h2>
                    <p className="text-muted-foreground text-sm">Cherchez et installez des mods via Modrinth.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/files', { state: { initialPath: getResolvedModPath(modPath) } })}
                        className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-surface border border-border rounded-md transition-colors"
                        title="Explorer les fichiers"
                    >
                        <Folder size={18} />
                        <span className="text-sm font-medium">Dossier</span>
                    </button>
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
                    {error instanceof Error ? error.message : String(error)}
                </div>
            )}

            {/* Pagination Controls (Top) */}
            {renderPagination("mt-4")}

            {/* Results Grid */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto mt-4 custom-scrollbar pr-2 pb-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
                        <Loader2 size={32} className="animate-spin text-primary" />
                        <p>Recherche en cours...</p>
                    </div>
                ) : processedResults.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {processedResults.map(mod => (
                            <ModCard 
                                key={mod.project_id} 
                                mod={mod as any} 
                                onInstall={handleInstallClick}
                                onViewDetails={(m) => setSelectedModDetails(m)}
                                isInstalling={installingMods.has(mod.project_id)}
                                isInstalled={mod.isInstalled}
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

            <ModDetailsModal
                isOpen={Boolean(selectedModDetails)}
                onClose={() => setSelectedModDetails(null)}
                modIdOrSlug={selectedModDetails?.project_id || selectedModDetails?.slug || null}
                onInstallVersion={executeInstallSpecificVersion}
                isInstalling={selectedModDetails ? installingMods.has(selectedModDetails.project_id) : false}
            />
        </div>
    );
};
