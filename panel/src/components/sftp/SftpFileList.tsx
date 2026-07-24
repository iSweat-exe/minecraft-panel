import React from 'react';
import { FileEntry } from '../../lib/tauriBridge';
import { Folder, FileText, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';
import { Checkbox } from '../ui/Checkbox';
import { ModFileRow } from './ModFileRow';
import { preloadModsByHashes } from '../../lib/modUtils';
import { tauriBridge } from '../../lib/tauriBridge';
import { SwitchVersionModal } from '../dialogs/SwitchVersionModal';
import { ModrinthProject, ModrinthVersion } from '../../api/modrinth';
import { logAction } from '../../lib/actionLogger';
import { EmptyState } from '../ui/EmptyState';

interface SftpFileListProps {
    entries: FileEntry[];
    loading: boolean;
    selectedFiles: Set<string>;
    sortConfig: { key: 'name'|'size'|'modified', direction: 'asc'|'desc' };
    onSort: (key: 'name'|'size'|'modified') => void;
    onNavigate: (e: React.MouseEvent, entry: FileEntry) => void;
    onDelete: (e: React.MouseEvent, entry: FileEntry) => void;
    onToggleSelect: (entry: FileEntry) => void;
    isModsFolder?: boolean;
    currentPath?: string;
    onRenameFile: (oldName: string, newName: string) => void;
    onRefresh?: () => void;
}

const useColumnResize = (initialWidths: Record<string, number>, storageKey: string) => {
    const [widths, setWidths] = React.useState<Record<string, number>>(() => {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            try { return JSON.parse(stored); } catch (e) {}
        }
        return initialWidths;
    });

    const isResizing = React.useRef(false);
    const currentColumn = React.useRef<string | null>(null);
    const startX = React.useRef(0);
    const startWidth = React.useRef(0);
    const tableRef = React.useRef<HTMLTableElement>(null);
    
    const currentWidthsRef = React.useRef(widths);
    currentWidthsRef.current = widths;

    // Apply initial CSS variables
    React.useEffect(() => {
        if (tableRef.current) {
            Object.entries(widths).forEach(([key, width]) => {
                tableRef.current?.style.setProperty(`--col-${key}`, `${width}px`);
            });
        }
    }, []);

    const handleMouseMove = React.useCallback((e: MouseEvent) => {
        if (!isResizing.current || !currentColumn.current) return;
        const diff = e.pageX - startX.current;
        let newWidth = startWidth.current + diff;
        newWidth = Math.max(50, newWidth); // min width 50px

        if (tableRef.current) {
            tableRef.current.style.setProperty(`--col-${currentColumn.current}`, `${newWidth}px`);
        }
        
        currentWidthsRef.current = { ...currentWidthsRef.current, [currentColumn.current]: newWidth };
    }, []);

    const handleMouseUp = React.useCallback(() => {
        isResizing.current = false;
        currentColumn.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        
        // Commit final state
        setWidths(currentWidthsRef.current);
    }, [handleMouseMove]);

    const startResize = (e: React.MouseEvent, column: string) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing.current = true;
        currentColumn.current = column;
        startX.current = e.pageX;
        startWidth.current = widths[column] || 100;
        
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };
    
    React.useEffect(() => {
        const timeout = setTimeout(() => {
            localStorage.setItem(storageKey, JSON.stringify(widths));
        }, 300);
        return () => clearTimeout(timeout);
    }, [widths, storageKey]);

    return { tableRef, startResize };
};

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
};

export const SftpFileList: React.FC<SftpFileListProps> = ({
    entries,
    loading,
    selectedFiles,
    sortConfig,
    onSort,
    onNavigate,
    onDelete,
    onToggleSelect,
    isModsFolder = false,
    currentPath,
    onRenameFile,
    onRefresh
}) => {
    const [hashPreloadTick, setHashPreloadTick] = React.useState(0);
    const [switchModalTarget, setSwitchModalTarget] = React.useState<{project: ModrinthProject, filename: string} | null>(null);

    React.useEffect(() => {
        if (!isModsFolder || !currentPath || entries.length === 0) return;
        
        let isMounted = true;
        const computeHashes = async () => {
            try {
                const host = localStorage.getItem('node_host');
                const port = localStorage.getItem('node_port') || '8080';
                const token = localStorage.getItem('node_token');
                if (!host || !token) return;
                const nodeUrl = `http://${host}:${port}`;

                const res = await tauriBridge.nodeApiRequest(
                    nodeUrl,
                    token,
                    "POST",
                    "/api/v1/files/hash_multiple",
                    { path: currentPath, patterns: ["*.jar", "*.disable", "*.disabled"] }
                );
                const fileHashMap = res?.data?.hashes || {};
                
                if (!isMounted) return;
                
                if (Object.keys(fileHashMap).length > 0) {
                    await preloadModsByHashes(fileHashMap);
                    if (isMounted) {
                        setHashPreloadTick(t => t + 1);
                    }
                }
            } catch (e) {
                console.error("Failed to compute hashes via Daemon API", e);
            }
        };
        
        computeHashes();
        return () => { isMounted = false; };
    }, [entries, isModsFolder, currentPath]);

    const { tableRef, startResize } = useColumnResize({
        checkbox: 48,
        name: 350,
        version: 180,
        size: 100,
        modified: 180,
        actions: 140
    }, 'sftp-column-widths');

    const handleSwitchVersion = async (newVersion: ModrinthVersion, oldFilename: string) => {
        if (!currentPath) return;
        
        try {
            const primaryFile = newVersion.files.find(f => f.primary) || newVersion.files[0];
            if (!primaryFile) {
                console.error("No file found in version", newVersion);
                return;
            }

            const oldPath = currentPath === '/' ? `/${oldFilename}` : `${currentPath}/${oldFilename}`;
            const newPath = currentPath === '/' ? `/${primaryFile.filename}` : `${currentPath}/${primaryFile.filename}`;
            
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            if (!host || !token) throw new Error("Daemon credentials missing");
            const nodeUrl = `http://${host}:${port}`;

            // 1. Delete old file
            await tauriBridge.nodeFileAction(nodeUrl, token, oldPath, "delete");
            
            // 2. Download new file using nodeDownloadRemote
            await tauriBridge.nodeDownloadRemote(nodeUrl, token, primaryFile.url, newPath);

            logAction('Changement de version d\'un mod', { old: oldFilename, new: primaryFile.filename });

            // 3. Refresh list
            if (onRefresh) onRefresh();
            
            setSwitchModalTarget(null);
        } catch (e) {
            console.error("Failed to switch version:", e);
        }
    };

    const SortIcon = ({ columnKey }: { columnKey: 'name'|'size'|'modified' }) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 inline" /> : <ChevronDown size={14} className="ml-1 inline" />;
    };

    const Resizer = ({ columnKey }: { columnKey: string }) => (
        <div 
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 group-hover:bg-primary/30 z-20"
            onMouseDown={(e) => startResize(e, columnKey)}
        />
    );

    return (
        <div className="flex-1 overflow-auto custom-scrollbar">
            <Table ref={tableRef} className="table-fixed w-full min-w-[800px]">
                <TableHeader className="sticky top-0 bg-zinc-950/90 backdrop-blur z-10">
                    <TableRow>
                        <TableHead className="text-center px-0 relative group" style={{ width: 'var(--col-checkbox)', minWidth: 'var(--col-checkbox)', maxWidth: 'var(--col-checkbox)' }}>
                            <Resizer columnKey="checkbox" />
                        </TableHead>
                        <TableHead className="relative group" style={{ width: 'var(--col-name)', minWidth: 'var(--col-name)', maxWidth: 'var(--col-name)' }}>
                            <div className="cursor-pointer hover:text-foreground inline-block w-full" onClick={() => onSort('name')}>
                                Name <SortIcon columnKey="name" />
                            </div>
                            <Resizer columnKey="name" />
                        </TableHead>
                        {isModsFolder && (
                            <TableHead className="relative group" style={{ width: 'var(--col-version)', minWidth: 'var(--col-version)', maxWidth: 'var(--col-version)' }}>
                                <span>Version</span>
                                <Resizer columnKey="version" />
                            </TableHead>
                        )}
                        <TableHead className="relative group" style={{ width: 'var(--col-size)', minWidth: 'var(--col-size)', maxWidth: 'var(--col-size)' }}>
                            <div className="cursor-pointer hover:text-foreground inline-block w-full" onClick={() => onSort('size')}>
                                Size <SortIcon columnKey="size" />
                            </div>
                            <Resizer columnKey="size" />
                        </TableHead>
                        <TableHead className="relative group" style={{ width: 'var(--col-modified)', minWidth: 'var(--col-modified)', maxWidth: 'var(--col-modified)' }}>
                            <div className="cursor-pointer hover:text-foreground inline-block w-full" onClick={() => onSort('modified')}>
                                Modified <SortIcon columnKey="modified" />
                            </div>
                            <Resizer columnKey="modified" />
                        </TableHead>
                        <TableHead className="text-right relative group" style={{ width: 'var(--col-actions)', minWidth: 'var(--col-actions)', maxWidth: 'var(--col-actions)' }}>
                            Actions
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {entries.length === 0 && !loading && (
                        <TableRow>
                            <TableCell colSpan={isModsFolder ? 6 : 5} className="py-6">
                                <EmptyState
                                    icon={Folder}
                                    title="Ce dossier est vide"
                                    description="Aucun fichier ni sous-dossier n'est présent dans ce répertoire."
                                    compact
                                    className="border-none bg-transparent"
                                />
                            </TableCell>
                        </TableRow>
                    )}
                    {entries.map((entry, idx) => {
                        const isSelected = selectedFiles.has(entry.name);
                        
                        if (isModsFolder && !entry.is_dir && (entry.name.endsWith('.jar') || entry.name.endsWith('.disable') || entry.name.endsWith('.disabled'))) {
                            return (
                                <ModFileRow
                                    key={`${entry.name}-${idx}`}
                                    entry={entry}
                                    isSelected={isSelected}
                                    onToggleSelect={onToggleSelect}
                                    onNavigate={onNavigate}
                                    onDelete={onDelete}
                                    onRenameFile={onRenameFile}
                                    formatBytes={formatBytes}
                                    formatDate={formatDate}
                                    hashPreloadTick={hashPreloadTick}
                                    onOpenSwitchVersion={(project, filename) => setSwitchModalTarget({ project, filename })}
                                />
                            );
                        }

                        return (
                            <TableRow 
                                key={`${entry.name}-${idx}`} 
                                onClick={(e) => onNavigate(e, entry)}
                                className={`cursor-pointer group ${isSelected ? 'bg-primary/20 hover:bg-primary/30' : ''}`}
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
                                <TableCell className="font-medium text-foreground">
                                    <div className="flex items-center gap-3">
                                        {entry.is_dir ? (
                                            <Folder size={16} className="text-warning" />
                                        ) : (
                                            <FileText size={16} className="text-muted-foreground" />
                                        )}
                                        {entry.name}
                                    </div>
                                </TableCell>
                                {isModsFolder && (
                                    <TableCell></TableCell>
                                )}
                                <TableCell className="text-muted-foreground text-xs font-mono">
                                    {!entry.is_dir ? formatBytes(entry.size) : '--'}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                    {formatDate(entry.modified)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <div className={`flex justify-end gap-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(e, entry);
                                                }}
                                                className="p-1 text-muted-foreground hover:text-danger transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            {switchModalTarget && (
                <SwitchVersionModal
                    isOpen={true}
                    onClose={() => setSwitchModalTarget(null)}
                    project={switchModalTarget.project}
                    currentFilename={switchModalTarget.filename}
                    onSwitchVersion={handleSwitchVersion}
                />
            )}
        </div>
    );
};
