import React, { useState, useEffect } from 'react';
import { TableRow, TableCell } from '../ui/Table';
import { Checkbox } from '../ui/Checkbox';
import { FileEntry } from '../../lib/tauriBridge';
import { Trash2, Package, Server, Monitor, User, ArrowRightLeft, MoreVertical } from 'lucide-react';
import { getModMetadata, parseModFilename, extractModVersion, hasUpdateCache } from '../../lib/modUtils';
import { ModrinthProject } from '../../hooks/useModrinth';
import { Switch } from '../ui/Switch';

interface ModFileRowProps {
    entry: FileEntry;
    isSelected: boolean;
    onToggleSelect: (entry: FileEntry) => void;
    onNavigate: (e: React.MouseEvent, entry: FileEntry) => void;
    onDelete: (e: React.MouseEvent, entry: FileEntry) => void;
    onRenameFile: (oldName: string, newName: string) => void;
    formatBytes: (bytes: number) => string;
    formatDate: (timestamp: number) => string;
    hashPreloadTick: number;
    onOpenSwitchVersion?: (project: ModrinthProject, currentFilename: string) => void;
}

export const ModFileRow: React.FC<ModFileRowProps> = ({
    entry,
    isSelected,
    onToggleSelect,
    onNavigate,
    onDelete,
    onRenameFile,
    formatBytes,
    formatDate,
    hashPreloadTick,
    onOpenSwitchVersion
}) => {
    const [metadata, setMetadata] = useState<ModrinthProject | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasUpdate, setHasUpdate] = useState(false);

    const isDisable = entry.name.endsWith('.disable') || entry.name.endsWith('.disabled');
    const cleanName = parseModFilename(entry.name) || entry.name;
    const extractedVersion = extractModVersion(entry.name);

    useEffect(() => {
        let mounted = true;
        
        getModMetadata(entry.name).then(data => {
            if (mounted) {
                setMetadata(data);
                setLoading(false);
                if (hasUpdateCache.get(entry.name)) {
                    setHasUpdate(true);
                }
            }
        });
        
        return () => {
            mounted = false;
        };
    }, [entry.name, hashPreloadTick]);

    const handleToggleState = (e: React.MouseEvent) => {
        e.stopPropagation();
        
        let newName = entry.name;
        if (isDisable) {
            newName = entry.name.replace(/\.disabled$/, '').replace(/\.disable$/, '');
        } else {
            newName = `${entry.name}.disable`;
        }
        
        onRenameFile(entry.name, newName);
    };

    return (
        <TableRow 
            onClick={(e) => onNavigate(e, entry)}
            className={`cursor-pointer group ${isSelected ? 'bg-primary/20 hover:bg-primary/30' : ''} ${isDisable ? 'opacity-60' : ''}`}
        >
            <TableCell className="px-3 text-center">
                <div className="w-4 h-4 mx-auto flex items-center justify-center">
                    <Checkbox 
                        checked={isSelected}
                        onChange={(e) => {
                            e.stopPropagation();
                            onToggleSelect(entry);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 cursor-pointer" 
                    />
                </div>
            </TableCell>
            
            <TableCell className="font-medium text-foreground py-2">
                <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-surface flex-shrink-0 flex items-center justify-center">
                        {metadata?.icon_url ? (
                            <img src={metadata.icon_url} alt={metadata.title} className="w-full h-full object-cover" />
                        ) : (
                            <Package size={20} className="text-muted-foreground" />
                        )}
                    </div>
                    
                    {/* Name & Author */}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-base truncate max-w-[200px] xl:max-w-[300px]" title={metadata?.title || cleanName}>
                                {metadata?.title || cleanName}
                            </span>
                            
                            {/* Badges */}
                            {!loading && metadata && (
                                <div className="flex gap-1 ml-1">
                                    {(metadata.server_side === 'required' || metadata.server_side === 'optional') && (
                                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                                            <Server size={10} /> Server
                                        </span>
                                    )}
                                    {(metadata.client_side === 'required' || metadata.client_side === 'optional') && (
                                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
                                            <Monitor size={10} /> Client
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        {metadata?.author ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                {metadata.author_avatar ? (
                                    <img src={metadata.author_avatar} alt={metadata.author} className="w-4 h-4 rounded-full object-cover" />
                                ) : (
                                    <User size={14} />
                                )}
                                <span>{metadata.author}</span>
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground mt-0.5 h-4"></div>
                        )}
                    </div>
                </div>
            </TableCell>
            
            <TableCell className="text-foreground">
                <div className="flex flex-col justify-center">
                    <span className="font-bold text-sm">{extractedVersion || '-'}</span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]" title={entry.name}>
                        {entry.name}
                    </span>
                </div>
            </TableCell>
            
            <TableCell className="text-muted-foreground text-xs font-mono">
                {formatBytes(entry.size)}
            </TableCell>
            
            <TableCell className="text-muted-foreground text-xs">
                {formatDate(entry.modified)}
            </TableCell>
            
            <TableCell className="text-right">
                <div className="flex items-center justify-end gap-4">
                    <div className="flex items-center justify-end gap-3">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (metadata && onOpenSwitchVersion) {
                                    onOpenSwitchVersion(metadata, entry.name);
                                }
                            }}
                            disabled={!metadata || loading}
                            className={`p-1.5 rounded-md transition-colors ${
                                (!metadata || loading) 
                                    ? 'text-muted-foreground/30 cursor-not-allowed' 
                                    : hasUpdate 
                                        ? 'text-success hover:bg-success/20'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-surface'
                            }`}
                            title={hasUpdate ? "Update available" : "Switch version"}
                        >
                            {hasUpdate ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" x2="12" y1="16" y2="8"/>
                                </svg>
                            ) : (
                                <ArrowRightLeft size={16} />
                            )}
                        </button>
                        
                        <div onClick={(e) => e.stopPropagation()}>
                            <Switch 
                                checked={!isDisable}
                                onChange={(e) => {
                                    // Use onChange instead of onClick for input elements
                                    const event = e as unknown as React.MouseEvent;
                                    handleToggleState(event);
                                }}
                                className="data-[state=checked]:bg-success"
                                title={isDisable ? "Activer le mod" : "Désactiver le mod"}
                            />
                        </div>
                        
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(e, entry);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                            title="Delete"
                        >
                            <Trash2 size={16} />
                        </button>

                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Implement more options
                            }}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface rounded-md transition-colors"
                            title="More options"
                        >
                            <MoreVertical size={16} />
                        </button>
                    </div>
                </div>
            </TableCell>
        </TableRow>
    );
};
