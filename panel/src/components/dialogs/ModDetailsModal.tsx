import React, { useState, useMemo, useDeferredValue, memo } from 'react';
import { 
    useFullProjectQuery, 
    useProjectVersionsQuery, 
    ModrinthVersion 
} from '../../api/modrinth';
import { Modal } from '../ui/Modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { SearchInput } from '../ui/SearchInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { ImageViewerModal } from './ImageViewerModal';
import { FaGithub } from 'react-icons/fa6';
import { 
    Download, 
    Heart, 
    Server, 
    Monitor, 
    ExternalLink, 
    Bug, 
    BookOpen, 
    MessageSquare, 
    Layers, 
    Image as ImageIcon, 
    FileText, 
    Check, 
    ChevronDown, 
    ChevronUp,
    Plus
} from 'lucide-react';

interface ModDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    modIdOrSlug: string | null;
    onInstallVersion?: (version: ModrinthVersion) => void;
    isInstalling?: boolean;
    isInstalled?: boolean;
}

const formatDate = (dateStr: string) => {
    try {
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return dateStr;
    }
};

// Memoized individual version card component to avoid re-rendering 2000+ items
interface VersionCardItemProps {
    ver: ModrinthVersion;
    onInstallVersion?: (version: ModrinthVersion) => void;
    isInstalling?: boolean;
}

const VersionCardItem = memo<VersionCardItemProps>(({ ver, onInstallVersion, isInstalling }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="border border-border bg-surface/40 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm font-mono">{ver.name || ver.version_number}</span>
                        <Badge 
                            variant={ver.version_type === 'release' ? 'success' : ver.version_type === 'beta' ? 'warning' : 'danger'}
                            className="text-[10px] uppercase font-mono"
                        >
                            {ver.version_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                            {formatDate(ver.date_published)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-muted-foreground font-semibold">Minecraft:</span>
                        <span className="font-mono text-foreground">{ver.game_versions.slice(0, 5).join(', ')}</span>
                        {ver.loaders.length > 0 && (
                            <>
                                <span className="text-muted-foreground font-semibold ml-2">Loader:</span>
                                {ver.loaders.map(l => (
                                    <Badge key={l} variant="outline" className="text-[10px] capitalize">
                                        {l}
                                    </Badge>
                                ))}
                            </>
                        )}
                    </div>
                </div>

                {onInstallVersion && (
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onInstallVersion(ver)}
                        disabled={isInstalling}
                        className="gap-1.5 shrink-0 text-xs"
                    >
                        <Download size={14} /> Installer
                    </Button>
                )}
            </div>

            {/* Changelog Toggle */}
            {ver.changelog && (
                <div>
                    <button
                        onClick={() => setIsExpanded(prev => !prev)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                    >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Masquer le changelog' : 'Voir le changelog'}
                    </button>
                    {isExpanded && (
                        <div className="mt-2 p-3 bg-black/50 border border-border/60 rounded-lg text-xs">
                            <MarkdownRenderer content={ver.changelog} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

VersionCardItem.displayName = 'VersionCardItem';

export const ModDetailsModal: React.FC<ModDetailsModalProps> = ({
    isOpen,
    onClose,
    modIdOrSlug,
    onInstallVersion,
    isInstalling,
    isInstalled
}) => {
    const { data: project, isLoading: loadingProject, error: projectError } = useFullProjectQuery(isOpen ? modIdOrSlug : null);
    const { data: versions = [], isLoading: loadingVersions } = useProjectVersionsQuery(isOpen ? modIdOrSlug : null);

    const [activeTab, setActiveTab] = useState<string>('description');
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

    // Version Filters & Deferred Search State for 60fps typing
    const [versionSearch, setVersionSearch] = useState<string>('');
    const deferredSearch = useDeferredValue(versionSearch);

    const [versionMcFilter, setVersionMcFilter] = useState<string>('all');
    const [versionLoaderFilter, setVersionLoaderFilter] = useState<string>('all');
    const [versionChannelFilter, setVersionChannelFilter] = useState<string>('all');

    // Progressive rendering pagination (limit rendered DOM items)
    const [visibleCount, setVisibleCount] = useState<number>(30);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    // Calculate unique available game versions for MC version filter dropdown
    const availableGameVersions = useMemo(() => {
        const set = new Set<string>();
        versions.forEach(v => v.game_versions?.forEach(g => set.add(g)));
        return Array.from(set).sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));
    }, [versions]);

    // Calculate unique available loaders for versions filter dropdown
    const availableLoaders = useMemo(() => {
        const set = new Set<string>();
        versions.forEach(v => v.loaders?.forEach(l => set.add(l.toLowerCase())));
        return Array.from(set).sort();
    }, [versions]);

    // Calculate filtered versions list based on criteria using deferred search
    const filteredVersions = useMemo(() => {
        const query = deferredSearch.trim().toLowerCase();
        return versions.filter(ver => {
            const matchesMc = versionMcFilter === 'all' || 
                ver.game_versions.some(g => g.toLowerCase() === versionMcFilter.toLowerCase());

            const matchesSearch = !query || 
                ver.game_versions.some(g => g.toLowerCase().includes(query)) ||
                ver.name.toLowerCase().includes(query) ||
                ver.version_number.toLowerCase().includes(query);

            const matchesLoader = versionLoaderFilter === 'all' || 
                ver.loaders.some(l => l.toLowerCase() === versionLoaderFilter.toLowerCase());

            const matchesChannel = versionChannelFilter === 'all' || 
                ver.version_type === versionChannelFilter;

            return matchesMc && matchesSearch && matchesLoader && matchesChannel;
        });
    }, [versions, versionMcFilter, deferredSearch, versionLoaderFilter, versionChannelFilter]);

    // Subset of versions to render in the DOM for extreme performance
    const visibleVersions = useMemo(() => {
        return filteredVersions.slice(0, visibleCount);
    }, [filteredVersions, visibleCount]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={project?.title || 'Détails du Mod'}
            maxWidth="max-w-6xl w-[92vw]"
            maxHeight="max-h-[85vh] overflow-y-auto"
        >
            {loadingProject ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <Spinner size={32} />
                    <p className="text-sm">Chargement des détails du mod depuis Modrinth...</p>
                </div>
            ) : projectError || !project ? (
                <EmptyState
                    icon={Bug}
                    title="Impossible de charger les détails du mod"
                    description="Une erreur est survenue lors de la récupération des données depuis Modrinth."
                />
            ) : (
                <div className="flex flex-col gap-6">
                    {/* Header Banner & Metadata */}
                    <div className="flex flex-col sm:flex-row gap-5 p-4 bg-surface/60 border border-border rounded-xl">
                        <img 
                            src={project.icon_url || 'https://docs.modrinth.com/img/logo.svg'} 
                            alt={project.title} 
                            className="w-24 h-24 rounded-xl object-cover bg-black/40 border border-border shrink-0 shadow-md"
                        />
                        <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground tracking-tight">{project.title}</h2>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{project.description}</p>
                                </div>
                                {isInstalled ? (
                                    <Button disabled variant="outline" size="sm" className="gap-2 text-success border-success/30">
                                        <Check size={16} /> Installé
                                    </Button>
                                ) : onInstallVersion && versions.length > 0 && (
                                    <Button 
                                        onClick={() => onInstallVersion(versions[0])} 
                                        disabled={isInstalling}
                                        variant="primary"
                                        size="sm"
                                        className="gap-2 shrink-0"
                                    >
                                        {isInstalling ? <Spinner size={16} /> : <Download size={16} />}
                                        {isInstalling ? 'Installation...' : 'Installer dernière version'}
                                    </Button>
                                )}
                            </div>

                            {/* Badges & Stats */}
                            <div className="flex items-center gap-3 flex-wrap text-xs">
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border/80 text-foreground font-mono">
                                    <Download size={13} className="text-muted-foreground" /> {formatNumber(project.downloads)}
                                </span>
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border/80 text-foreground font-mono">
                                    <Heart size={13} className="text-rose-400" /> {formatNumber(project.followers)}
                                </span>

                                {/* Server & Client Side Support */}
                                {project.server_side !== 'unsupported' && (
                                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <Server size={13} /> Serveur: {project.server_side}
                                    </span>
                                )}
                                {project.client_side !== 'unsupported' && (
                                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        <Monitor size={13} /> Client: {project.client_side}
                                    </span>
                                )}

                                {/* Categories */}
                                {project.categories.slice(0, 4).map(cat => (
                                    <Badge key={cat} variant="outline" className="capitalize text-[10px]">
                                        {cat}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tabs Navigation */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                        <TabsList className="mb-4">
                            <TabsTrigger value="description" className="gap-2">
                                <FileText size={15} /> Description
                            </TabsTrigger>
                            <TabsTrigger value="gallery" className="gap-2">
                                <ImageIcon size={15} /> Galerie ({project.gallery.length})
                            </TabsTrigger>
                            <TabsTrigger value="versions" className="gap-2">
                                <Layers size={15} /> Versions ({filteredVersions.length}{filteredVersions.length !== versions.length ? ` / ${versions.length}` : ''})
                            </TabsTrigger>
                            <TabsTrigger value="links" className="gap-2">
                                <ExternalLink size={15} /> Liens & Infos
                            </TabsTrigger>
                        </TabsList>

                        {/* TAB 1: DESCRIPTION */}
                        <TabsContent value="description" className="max-h-[65vh] overflow-y-auto custom-scrollbar p-5 bg-surface/30 border border-border rounded-xl">
                            {project.body ? (
                                <MarkdownRenderer content={project.body} />
                            ) : (
                                <p className="text-sm text-muted-foreground italic">Aucune description détaillée fournie par l'auteur.</p>
                            )}
                        </TabsContent>

                        {/* TAB 2: GALLERY */}
                        <TabsContent value="gallery" className="max-h-[65vh] overflow-y-auto custom-scrollbar">
                            {project.gallery.length === 0 ? (
                                <EmptyState
                                    icon={ImageIcon}
                                    title="Aucune image dans la galerie"
                                    description="L'auteur n'a pas encore téléversé de capture d'écran pour ce mod."
                                    compact
                                />
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {project.gallery.map((img, idx) => (
                                        <div 
                                            key={idx} 
                                            onClick={() => setSelectedImageIndex(idx)}
                                            className="group relative border border-border rounded-xl overflow-hidden bg-black cursor-pointer hover:border-primary/60 transition-all shadow-sm aspect-video"
                                        >
                                            <img 
                                                src={img.url} 
                                                alt={img.title || `Screenshot ${idx + 1}`} 
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                            {img.title && (
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6 pointer-events-none">
                                                    <p className="text-xs font-semibold text-white truncate">{img.title}</p>
                                                    {img.description && <p className="text-[11px] text-zinc-300 truncate">{img.description}</p>}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        {/* TAB 3: VERSIONS */}
                        <TabsContent value="versions" className="max-h-[65vh] flex flex-col min-h-0">
                            {/* Version Filters Toolbar */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 p-3 bg-surface/60 border border-border rounded-xl shrink-0">
                                <div className="flex items-center gap-2 flex-wrap flex-1">
                                    {/* Minecraft Version Dropdown */}
                                    {availableGameVersions.length > 0 && (
                                        <Select
                                            value={versionMcFilter}
                                            onValueChange={(val) => {
                                                setVersionMcFilter(val);
                                                setVisibleCount(30);
                                            }}
                                        >
                                            <SelectTrigger className="w-[180px] bg-surface h-9 text-xs border-border text-foreground">
                                                <SelectValue placeholder="Toutes les versions MC" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-60">
                                                <SelectItem value="all">Toutes les versions MC</SelectItem>
                                                {availableGameVersions.map(v => (
                                                    <SelectItem key={v} value={v} className="text-xs font-mono">
                                                        {v}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}

                                    {/* Mod Loader Dropdown */}
                                    {availableLoaders.length > 0 && (
                                        <Select
                                            value={versionLoaderFilter}
                                            onValueChange={(val) => {
                                                setVersionLoaderFilter(val);
                                                setVisibleCount(30);
                                            }}
                                        >
                                            <SelectTrigger className="w-[150px] bg-surface h-9 text-xs border-border text-foreground">
                                                <SelectValue placeholder="Tous les Loaders" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Tous les Loaders</SelectItem>
                                                {availableLoaders.map(l => (
                                                    <SelectItem key={l} value={l} className="capitalize text-xs">
                                                        {l}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}

                                    {/* Search Input by name */}
                                    <SearchInput
                                        value={versionSearch}
                                        onChange={(val) => {
                                            setVersionSearch(val);
                                            setVisibleCount(30);
                                        }}
                                        placeholder="Chercher par nom..."
                                        className="w-[180px]"
                                    />
                                </div>

                                {/* Release Channel Pill Filters */}
                                <div className="flex items-center bg-background border border-border/80 rounded-lg p-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setVersionChannelFilter('all');
                                            setVisibleCount(30);
                                        }}
                                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                                            versionChannelFilter === 'all' ? 'bg-primary/20 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Tous
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setVersionChannelFilter('release');
                                            setVisibleCount(30);
                                        }}
                                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                                            versionChannelFilter === 'release' ? 'bg-emerald-500/20 text-emerald-400 font-semibold' : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Release
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setVersionChannelFilter('beta');
                                            setVisibleCount(30);
                                        }}
                                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                                            versionChannelFilter === 'beta' ? 'bg-amber-500/20 text-amber-400 font-semibold' : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Beta
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setVersionChannelFilter('alpha');
                                            setVisibleCount(30);
                                        }}
                                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                                            versionChannelFilter === 'alpha' ? 'bg-rose-500/20 text-rose-400 font-semibold' : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        Alpha
                                    </button>
                                </div>
                            </div>

                            {/* Versions List */}
                            <div className="overflow-y-auto custom-scrollbar space-y-3 flex-1 pr-1">
                                {loadingVersions ? (
                                    <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
                                        <Spinner size={18} /> Chargement des versions...
                                    </div>
                                ) : filteredVersions.length === 0 ? (
                                    <EmptyState
                                        icon={Layers}
                                        title="Aucune version correspondante"
                                        description="Aucune version ne correspond à vos critères de filtrage."
                                        compact
                                    />
                                ) : (
                                    <>
                                        {visibleVersions.map(ver => (
                                            <VersionCardItem 
                                                key={ver.id} 
                                                ver={ver} 
                                                onInstallVersion={onInstallVersion}
                                                isInstalling={isInstalling}
                                            />
                                        ))}

                                        {visibleCount < filteredVersions.length && (
                                            <div className="flex justify-center py-3">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => setVisibleCount(prev => prev + 50)}
                                                    className="gap-2 text-xs font-medium"
                                                >
                                                    <Plus size={14} /> Charger plus de versions ({visibleCount} sur {filteredVersions.length})
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </TabsContent>

                        {/* TAB 4: LINKS & INFOS */}
                        <TabsContent value="links" className="max-h-[65vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* External Links */}
                                <div className="p-4 bg-surface/40 border border-border rounded-xl space-y-3">
                                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                        <ExternalLink size={16} className="text-primary" /> Liens officiels
                                    </h3>
                                    <div className="flex flex-col gap-2 text-xs">
                                        {project.source_url && (
                                            <a 
                                                href={project.source_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="flex items-center gap-2 p-2 rounded-lg bg-background hover:bg-surface border border-border/80 text-foreground transition-colors"
                                            >
                                                <FaGithub size={15} className="text-muted-foreground" /> Code source GitHub
                                            </a>
                                        )}
                                        {project.issues_url && (
                                            <a 
                                                href={project.issues_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="flex items-center gap-2 p-2 rounded-lg bg-background hover:bg-surface border border-border/80 text-foreground transition-colors"
                                            >
                                                <Bug size={15} className="text-rose-400" /> Signalement de bugs (Issues)
                                            </a>
                                        )}
                                        {project.wiki_url && (
                                            <a 
                                                href={project.wiki_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="flex items-center gap-2 p-2 rounded-lg bg-background hover:bg-surface border border-border/80 text-foreground transition-colors"
                                            >
                                                <BookOpen size={15} className="text-amber-400" /> Documentation / Wiki
                                            </a>
                                        )}
                                        {project.discord_url && (
                                            <a 
                                                href={project.discord_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="flex items-center gap-2 p-2 rounded-lg bg-background hover:bg-surface border border-border/80 text-foreground transition-colors"
                                            >
                                                <MessageSquare size={15} className="text-indigo-400" /> Serveur Discord
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* License & Donations */}
                                <div className="p-4 bg-surface/40 border border-border rounded-xl space-y-4">
                                    {project.license && (
                                        <div className="space-y-1">
                                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Licence</h3>
                                            <p className="text-sm font-semibold text-foreground">{project.license.name || project.license.id}</p>
                                        </div>
                                    )}

                                    {project.donation_urls && project.donation_urls.length > 0 && (
                                        <div className="space-y-2">
                                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                <Heart size={13} className="text-rose-400" /> Soutenir l'auteur
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {project.donation_urls.map(don => (
                                                    <a 
                                                        key={don.id} 
                                                        href={don.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-xs px-3 py-1.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors font-medium capitalize"
                                                    >
                                                        {don.platform || 'Faire un don'}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            )}

            {/* FULLSCREEN IMAGE VIEWER MODAL */}
            {project && (
                <ImageViewerModal
                    isOpen={selectedImageIndex !== null}
                    onClose={() => setSelectedImageIndex(null)}
                    images={project.gallery}
                    initialIndex={selectedImageIndex ?? 0}
                />
            )}
        </Modal>
    );
};
