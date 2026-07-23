import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Eye, EyeOff, AlertTriangle, Download, Package } from 'lucide-react';
import { fetchProjectVersions } from '../../api/modrinth';
import type { ModrinthProject, ModrinthVersion } from '../../api/modrinth';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

interface SwitchVersionModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: ModrinthProject;
    currentFilename: string;
    onSwitchVersion: (newVersion: ModrinthVersion, oldFilename: string) => void;
}

export const SwitchVersionModal: React.FC<SwitchVersionModalProps> = ({ 
    isOpen, 
    onClose, 
    project, 
    currentFilename,
    onSwitchVersion
}) => {
    const [loading, setLoading] = useState(false);
    const [versions, setVersions] = useState<ModrinthVersion[]>([]);
    const [search, setSearch] = useState('');
    const [showIncompatible, setShowIncompatible] = useState(false);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

    // Fetch versions when modal opens
    useEffect(() => {
        if (!isOpen) return;
        
        const projectId = project.project_id || (project as any).id;
        if (!projectId) return;

        let mounted = true;
        setLoading(true);
        fetchProjectVersions(projectId).then(data => {
            if (mounted && data) {
                setVersions(data);
            }
        }).catch(err => {
            console.error("Failed to fetch versions", err);
        }).finally(() => {
            if (mounted) setLoading(false);
        });
        
        return () => { mounted = false; };
    }, [isOpen, project]);

    // Figure out the current version from the list by matching filename (if possible)
    const currentVersionId = useMemo(() => {
        const match = versions.find(v => v.files.some(f => f.filename === currentFilename));
        return match ? match.id : null;
    }, [versions, currentFilename]);

    // Figure out server loaders/game_versions based on current version, fallback to project's first elements
    const serverLoaders = useMemo(() => {
        if (currentVersionId) {
            const v = versions.find(v => v.id === currentVersionId);
            if (v && v.loaders.length > 0) return v.loaders;
        }
        return ['fabric', 'forge', 'quilt', 'neoforge']; // If unknown, assume any might be okay
    }, [versions, currentVersionId]);

    const serverGameVersions = useMemo(() => {
        if (currentVersionId) {
            const v = versions.find(v => v.id === currentVersionId);
            if (v && v.game_versions.length > 0) return v.game_versions;
        }
        return [];
    }, [versions, currentVersionId]);

    const filteredVersions = useMemo(() => {
        return versions.filter(v => {
            // Search text
            const searchMatch = v.version_number.toLowerCase().includes(search.toLowerCase()) || 
                                v.name.toLowerCase().includes(search.toLowerCase());
            if (!searchMatch) return false;
            
            // Compatibility filter
            if (!showIncompatible && serverGameVersions.length > 0) {
                const hasCompatibleLoader = v.loaders.some(l => serverLoaders.includes(l));
                const hasCompatibleGameVersion = v.game_versions.some(gv => serverGameVersions.includes(gv));
                if (!hasCompatibleLoader || !hasCompatibleGameVersion) {
                    return false;
                }
            }
            
            return true;
        });
    }, [versions, search, showIncompatible, serverLoaders, serverGameVersions]);

    // Automatically select the first filtered version if current selection is invalid
    useEffect(() => {
        if (filteredVersions.length > 0) {
            const isValidSelection = selectedVersionId && filteredVersions.some(v => v.id === selectedVersionId);
            if (!isValidSelection) {
                setSelectedVersionId(filteredVersions[0].id);
            }
        } else if (filteredVersions.length === 0 && selectedVersionId) {
            setSelectedVersionId(null);
        }
    }, [filteredVersions, selectedVersionId]);

    const selectedVersion = versions.find(v => v.id === selectedVersionId) || null;

    if (!isOpen) return null;

    const getVersionBadgeClass = (type: string) => {
        switch (type) {
            case 'release': return 'bg-success/20 text-success border-success/30';
            case 'beta': return 'bg-warning/20 text-warning border-warning/30';
            case 'alpha': return 'bg-danger/20 text-danger border-danger/30';
            default: return 'bg-muted/20 text-muted-foreground border-border';
        }
    };
    
    const getVersionBadgeLetter = (type: string) => {
        switch (type) {
            case 'release': return 'R';
            case 'beta': return 'B';
            case 'alpha': return 'A';
            default: return '?';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 lg:p-10">
            <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-surface-hover/30 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md overflow-hidden bg-surface flex items-center justify-center">
                            {project.icon_url ? (
                                <img src={project.icon_url} alt={project.title} className="w-full h-full object-cover" />
                            ) : (
                                <Package size={20} className="text-muted-foreground" />
                            )}
                        </div>
                        <h2 className="text-xl font-bold text-foreground">Switch version</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[300px_1fr] min-h-0">
                    {/* Left Sidebar - Version List */}
                    <div className="border-r border-border flex flex-col bg-surface/30 overflow-hidden">
                        <div className="p-4 border-b border-border shrink-0">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input 
                                    type="text" 
                                    placeholder="Search version..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {loading ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">Loading versions...</div>
                            ) : filteredVersions.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">No versions found.</div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {filteredVersions.map(v => (
                                        <button
                                            key={v.id}
                                            onClick={() => setSelectedVersionId(v.id)}
                                            className={`flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                                                selectedVersionId === v.id 
                                                    ? 'bg-primary/20 border border-primary/30' 
                                                    : 'hover:bg-surface border border-transparent'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 truncate pr-2">
                                                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${getVersionBadgeClass(v.version_type)}`}>
                                                    {getVersionBadgeLetter(v.version_type)}
                                                </span>
                                                <span className={`text-sm truncate font-medium ${selectedVersionId === v.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                                    {v.version_number}
                                                </span>
                                            </div>
                                            {currentVersionId === v.id && (
                                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-hover text-muted-foreground shrink-0 border border-border">
                                                    Current
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="p-3 border-t border-border shrink-0 flex items-center justify-center bg-surface-hover/30">
                            <button 
                                onClick={() => setShowIncompatible(!showIncompatible)}
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showIncompatible ? <Eye size={16} /> : <EyeOff size={16} />}
                                {showIncompatible ? 'Hide incompatible' : 'Show incompatible'}
                            </button>
                        </div>
                    </div>

                    {/* Right Content - Changelog */}
                    <div className="flex flex-col bg-background overflow-hidden relative">
                        {selectedVersion ? (
                            <>
                                <div className="p-6 border-b border-border shrink-0">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-2xl font-bold text-foreground">{selectedVersion.version_number}</h3>
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${getVersionBadgeClass(selectedVersion.version_type)}`}>
                                                {selectedVersion.version_type.charAt(0).toUpperCase() + selectedVersion.version_type.slice(1)}
                                            </span>
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                            {new Date(selectedVersion.date_published).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <FileTextIcon size={14} />
                                            <span>Changelog</span>
                                        </div>
                                        <span className="text-border">•</span>
                                        <span className="font-medium text-foreground/80">{selectedVersion.loaders.join(', ')} {selectedVersion.game_versions[0]}</span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                                    {selectedVersion.changelog ? (
                                        <MarkdownRenderer content={selectedVersion.changelog} />
                                    ) : (
                                        <p className="text-muted-foreground italic">No changelog provided.</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                {loading ? 'Loading...' : 'Select a version to view details.'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border flex items-center justify-between bg-surface-hover/30 shrink-0">
                    <div className="flex items-center gap-2 text-warning max-w-[60%]">
                        <AlertTriangle size={20} className="shrink-0" />
                        <span className="text-sm font-medium leading-tight">
                            Updating can break your instance. Review version changelogs and back up first.
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-foreground hover:bg-surface border border-border rounded-lg transition-colors flex items-center gap-2"
                        >
                            <X size={16} /> Cancel
                        </button>
                        
                        {selectedVersion && selectedVersion.id !== currentVersionId && (
                            <button
                                onClick={() => onSwitchVersion(selectedVersion, currentFilename)}
                                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary-hover rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Download size={16} /> Switch to {selectedVersion.version_number}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const FileTextIcon = ({ size = 16, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" x2="8" y1="13" y2="13"/>
        <line x1="16" x2="8" y1="17" y2="17"/>
        <line x1="10" x2="8" y1="9" y2="9"/>
    </svg>
);
