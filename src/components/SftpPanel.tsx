import React, { useState, useEffect, useRef, useCallback } from 'react';
import { tauriBridge, FileEntry } from '../lib/tauriBridge';
import { FileText, Folder, Trash2, CornerLeftUp, FolderPlus, RefreshCw, Copy, Scissors, XSquare, Upload, Home, ChevronRight } from 'lucide-react';
import { FileEditor } from './FileEditor';
import { ConfirmDialog } from './dialogs/ConfirmDialog';
import { PromptDialog } from './dialogs/PromptDialog';
import { UploadModal, UploadFileItem } from './UploadModal';

export const SftpPanel: React.FC = () => {
    const [currentPath, setCurrentPath] = useState<string>('/');
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Multi-selection
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [clipboard, setClipboard] = useState<{ action: 'copy' | 'cut', files: string[], path: string } | null>(null);

    // File Editor State
    const [editingFile, setEditingFile] = useState<{path: string, content: string} | null>(null);

    // Drag & drop overlay
    const [isDragging, setIsDragging] = useState(false);

    // Upload modal
    const [uploadFiles, setUploadFiles] = useState<UploadFileItem[] | null>(null);

    const fetchDir = async (path: string) => {
        setLoading(true);
        setError(null);
        setSelectedFiles(new Set()); // Reset selection on navigate
        try {
            const data = await tauriBridge.sftpListDir(path);
            setEntries(data);
            setCurrentPath(path);
        } catch (e: any) {
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    };

    const stateRef = useRef({ currentPath, entries });
    useEffect(() => {
        stateRef.current = { currentPath, entries };
    }, [currentPath, entries]);

    // Upload queue processor — only uploads files with 'pending' status
    const processUploads = useCallback(async (files: UploadFileItem[]) => {
        for (let i = 0; i < files.length; i++) {
            // Read current status from state
            const currentFiles = await new Promise<UploadFileItem[] | null>(resolve => {
                setUploadFiles(prev => { resolve(prev); return prev; });
            });
            if (!currentFiles) return;

            // Skip non-pending files (conflict, cancelled, already done)
            if (currentFiles[i].status !== 'pending') continue;

            // Mark as uploading
            setUploadFiles(prev => {
                if (!prev) return null;
                const next = [...prev];
                next[i] = { ...next[i], status: 'uploading' };
                return next;
            });

            try {
                await tauriBridge.sftpUploadFile(files[i].localPath, files[i].remotePath);
                setUploadFiles(prev => {
                    if (!prev) return null;
                    const next = [...prev];
                    next[i] = { ...next[i], status: 'done', progress: 100 };
                    return next;
                });
            } catch (err: any) {
                setUploadFiles(prev => {
                    if (!prev) return null;
                    const next = [...prev];
                    next[i] = { ...next[i], status: 'error', error: err.toString() };
                    return next;
                });
            }
        }
    }, []);

    // Resolve a single conflict file: 'replace' → mark pending & upload, 'skip' → mark cancelled
    const resolveConflict = useCallback(async (index: number, action: 'replace' | 'skip') => {
        if (action === 'skip') {
            setUploadFiles(prev => {
                if (!prev) return null;
                const next = [...prev];
                next[index] = { ...next[index], status: 'cancelled' };
                return next;
            });
            return;
        }

        // Mark as uploading and start upload
        setUploadFiles(prev => {
            if (!prev) return null;
            const next = [...prev];
            next[index] = { ...next[index], status: 'uploading', progress: 0 };
            return next;
        });

        const currentFiles = await new Promise<UploadFileItem[] | null>(resolve => {
            setUploadFiles(prev => { resolve(prev); return prev; });
        });
        if (!currentFiles) return;

        const file = currentFiles[index];
        try {
            await tauriBridge.sftpUploadFile(file.localPath, file.remotePath);
            setUploadFiles(prev => {
                if (!prev) return null;
                const next = [...prev];
                next[index] = { ...next[index], status: 'done', progress: 100 };
                return next;
            });
        } catch (err: any) {
            setUploadFiles(prev => {
                if (!prev) return null;
                const next = [...prev];
                next[index] = { ...next[index], status: 'error', error: err.toString() };
                return next;
            });
        }
    }, []);

    const undoCancel = useCallback((index: number) => {
        setUploadFiles(prev => {
            if (!prev) return null;
            const next = [...prev];
            const file = next[index];
            const { entries: ce } = stateRef.current;
            const exists = ce.some(e => e.name === file.filename);
            
            next[index] = { ...file, status: exists ? 'conflict' : 'pending' };
            
            // If it becomes pending, we need to process it
            if (!exists) {
                // We run processUploads in the next tick to ensure state is updated
                setTimeout(() => {
                    setUploadFiles(current => {
                        if (current) processUploads(current);
                        return current;
                    });
                }, 0);
            }
            
            return next;
        });
    }, [processUploads]);

    useEffect(() => {
        fetchDir('/');

        let unlistenDrop: () => void;
        let unlistenProgress: () => void;

        tauriBridge.onFileDrop({
            onDrop: (paths) => {
                if (!paths || paths.length === 0) return;
                const { currentPath: cp, entries: ce } = stateRef.current;

                const items: UploadFileItem[] = paths.map(localPath => {
                    const filename = localPath.replace(/\\/g, '/').split('/').pop() || 'unknown';
                    const remotePath = cp === '/' ? `/${filename}` : `${cp}/${filename}`;
                    const exists = ce.some(e => e.name === filename);
                    return {
                        filename,
                        localPath,
                        remotePath,
                        status: exists ? 'conflict' as const : 'pending' as const,
                        progress: 0,
                    };
                });

                setUploadFiles(items);
                processUploads(items);
            },
            onHover: (hovering) => setIsDragging(hovering),
        }).then(unlisten => {
            unlistenDrop = unlisten;
        });

        tauriBridge.onUploadProgress((progress) => {
            setUploadFiles(prev => {
                if (!prev) return null;
                return prev.map(f => {
                    if (f.filename === progress.filename && f.status === 'uploading') {
                        const pct = progress.total > 0 ? Math.round((progress.written / progress.total) * 100) : 0;
                        return { ...f, progress: pct };
                    }
                    return f;
                });
            });
        }).then(unlisten => {
            unlistenProgress = unlisten;
        });

        return () => {
            if (unlistenDrop) unlistenDrop();
            if (unlistenProgress) unlistenProgress();
        };
    }, [processUploads]);

    const handleNavigate = (e: React.MouseEvent, entry: FileEntry) => {
        if (e.ctrlKey || e.metaKey) {
            e.stopPropagation();
            const newSelected = new Set(selectedFiles);
            if (newSelected.has(entry.name)) {
                newSelected.delete(entry.name);
            } else {
                newSelected.add(entry.name);
            }
            setSelectedFiles(newSelected);
            return;
        }

        if (entry.is_dir) {
            const newPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
            fetchDir(newPath);
        } else {
            // Open editor
            openEditor(entry.name);
        }
    };

    const handleNavigateUp = () => {
        if (currentPath === '/') return;
        const parts = currentPath.split('/');
        parts.pop();
        const newPath = parts.join('/') || '/';
        fetchDir(newPath);
    };

    const openEditor = async (filename: string) => {
        const fullPath = currentPath === '/' ? `/${filename}` : `${currentPath}/${filename}`;
        try {
            const content = await tauriBridge.sftpReadFile(fullPath);
            setEditingFile({ path: fullPath, content });
        } catch (e: any) {
            setError(`Cannot read file: ${e.toString()}`);
        }
    };

    const saveEditor = async (content: string) => {
        if (!editingFile) return;
        try {
            await tauriBridge.sftpWriteFile(editingFile.path, content);
            setEditingFile(null);
            fetchDir(currentPath);
        } catch (e: any) {
            setError(`Cannot save file: ${e.toString()}`);
        }
    };

    const handleDelete = async (e: React.MouseEvent, entry: FileEntry) => {
        e.stopPropagation();
        
        const confirmed = await ConfirmDialog.call({ 
            title: "Delete File",
            message: `Are you sure you want to delete ${entry.name}?` 
        });
        
        if (!confirmed) return;
        
        const fullPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
        try {
            await tauriBridge.sftpDelete(fullPath, entry.is_dir);
            fetchDir(currentPath);
        } catch (err: any) {
            setError(`Delete failed: ${err.toString()}`);
        }
    };

    const handleMkdir = async () => {
        const name = await PromptDialog.call({
            title: "Directory name:"
        });
        if (!name) return;
        
        if (entries.some(e => e.name === name)) {
            setError(`A file or folder named ${name} already exists.`);
            return;
        }

        const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
        try {
            await tauriBridge.sftpMkdir(fullPath);
            fetchDir(currentPath);
        } catch (err: any) {
            setError(`Mkdir failed: ${err.toString()}`);
        }
    };

    const handleMkfile = async () => {
        const name = await PromptDialog.call({
            title: "File name:"
        });
        if (!name) return;
        
        if (entries.some(e => e.name === name)) {
            const confirmed = await ConfirmDialog.call({
                title: "File exists",
                message: `The file ${name} already exists. Do you want to overwrite it?`
            });
            if (!confirmed) return;
        }

        const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
        try {
            await tauriBridge.sftpWriteFile(fullPath, "");
            fetchDir(currentPath);
        } catch (err: any) {
            setError(`Create file failed: ${err.toString()}`);
        }
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

    if (editingFile) {
        return (
            <FileEditor 
                path={editingFile.path} 
                initialContent={editingFile.content}
                onSave={saveEditor}
                onCancel={() => setEditingFile(null)}
            />
        );
    }

    return (
        <div className="h-full flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm relative">
            {/* Drop zone overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm border-2 border-dashed border-indigo-500/50 rounded-xl">
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                        <div className="p-5 bg-indigo-500/10 rounded-2xl border border-indigo-500/30">
                            <Upload size={40} className="text-indigo-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-zinc-100">Déposez vos fichiers ici</p>
                            <p className="text-sm text-zinc-500 mt-1">dans <span className="text-indigo-400 font-mono">{currentPath}</span></p>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload modal */}
            {uploadFiles && (
                <UploadModal
                    files={uploadFiles}
                    onCancel={(index) => {
                        setUploadFiles(prev => {
                            if (!prev) return null;
                            const next = [...prev];
                            next[index] = { ...next[index], status: 'cancelled' };
                            return next;
                        });
                    }}
                    onResolveConflict={resolveConflict}
                    onUndoCancel={undoCancel}
                    onContinue={() => {
                        setUploadFiles(null);
                        fetchDir(currentPath);
                    }}
                />
            )}
            {/* Toolbar */}
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-2 overflow-hidden text-sm">
                    <button 
                        onClick={handleNavigateUp}
                        disabled={currentPath === '/'}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
                    >
                        <CornerLeftUp size={16} />
                    </button>
                    {/* Premium Breadcrumb */}
                    <div className="flex-1 flex items-center bg-zinc-950/50 rounded-lg border border-zinc-800/80 px-2 py-1.5 overflow-hidden shadow-inner">
                        <button
                            onClick={() => fetchDir('/')}
                            className={`p-1 rounded-md transition-colors shrink-0 ${currentPath === '/' ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                            title="Racine (Root)"
                        >
                            <Home size={14} />
                        </button>
                        
                        {currentPath.split('/').filter(Boolean).map((part, index, arr) => {
                            const pathToHere = '/' + arr.slice(0, index + 1).join('/');
                            const isLast = index === arr.length - 1;
                            return (
                                <React.Fragment key={pathToHere}>
                                    <ChevronRight size={14} className="text-zinc-600 mx-0.5 shrink-0" />
                                    <button
                                        onClick={() => fetchDir(pathToHere)}
                                        className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors truncate max-w-[120px] sm:max-w-[200px] ${
                                            isLast 
                                                ? 'text-zinc-200 bg-zinc-800' 
                                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                        }`}
                                    >
                                        {part}
                                    </button>
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Stats with icons and clear labels */}
                    {entries.length > 0 && (
                        <div className="hidden md:flex items-center gap-3 ml-3 px-3 py-1.5 bg-zinc-950/50 rounded-lg border border-zinc-800/80 text-[11px] text-zinc-400 whitespace-nowrap shadow-inner">
                            <div className="flex items-center gap-1.5">
                                <Folder size={12} className="text-amber-500/80" />
                                <span>{entries.filter(e => e.is_dir).length} dossier{entries.filter(e => e.is_dir).length > 1 ? 's' : ''}</span>
                            </div>
                            <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
                            <div className="flex items-center gap-1.5">
                                <FileText size={12} className="text-blue-400/80" />
                                <span>{entries.filter(e => !e.is_dir).length} fichier{entries.filter(e => !e.is_dir).length > 1 ? 's' : ''}</span>
                            </div>
                            <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
                            <div className="font-medium text-zinc-300">
                                {entries.length} total
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleMkfile} className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded transition-colors" title="New File">
                        <FileText size={16} />
                    </button>
                    <button onClick={handleMkdir} className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded transition-colors" title="New Folder">
                        <FolderPlus size={16} />
                    </button>
                    <button onClick={() => fetchDir(currentPath)} className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors" title="Refresh">
                        <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-400' : ''} />
                    </button>
                </div>
            </div>

            {/* Multi-selection Action Bar */}
            {selectedFiles.size > 0 && (
                <div className="px-4 py-2 bg-indigo-900/30 border-b border-indigo-500/30 flex items-center justify-between">
                    <span className="text-sm text-indigo-300 font-medium">
                        {selectedFiles.size} item{selectedFiles.size > 1 ? 's' : ''} selected
                    </span>
                    <div className="flex items-center gap-2">
                        {clipboard && (
                            <button 
                                onClick={async () => {
                                    for (const file of clipboard.files) {
                                        if (entries.some(e => e.name === file)) {
                                            const confirmed = await ConfirmDialog.call({
                                                title: "File exists",
                                                message: `The file ${file} already exists. Do you want to overwrite it?`
                                            });
                                            if (!confirmed) continue;
                                        }

                                        const src = clipboard.path === '/' ? `/${file}` : `${clipboard.path}/${file}`;
                                        const dest = currentPath === '/' ? `/${file}` : `${currentPath}/${file}`;
                                        try {
                                            if (clipboard.action === 'cut') {
                                                await tauriBridge.sftpRename(src, dest);
                                            } else {
                                                await tauriBridge.sshCopy(src, dest);
                                            }
                                        } catch (e: any) {
                                            setError(`Paste failed: ${e.toString()}`);
                                        }
                                    }
                                    if (clipboard.action === 'cut') {
                                        setClipboard(null);
                                    }
                                    fetchDir(currentPath);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium rounded-md transition-colors border border-emerald-500/30"
                            >
                                <Copy size={14} /> Paste ({clipboard.files.length})
                            </button>
                        )}
                        <button 
                            onClick={() => {
                                setClipboard({ action: 'copy', files: Array.from(selectedFiles), path: currentPath });
                                setSelectedFiles(new Set());
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-white hover:bg-indigo-500/20 rounded-md transition-colors"
                        >
                            <Copy size={14} /> Copy
                        </button>
                        <button 
                            onClick={() => {
                                setClipboard({ action: 'cut', files: Array.from(selectedFiles), path: currentPath });
                                setSelectedFiles(new Set());
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-white hover:bg-indigo-500/20 rounded-md transition-colors"
                        >
                            <Scissors size={14} /> Cut
                        </button>
                        <div className="w-px h-4 bg-indigo-500/30 mx-1"></div>
                        <button 
                            onClick={() => setSelectedFiles(new Set())}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-white hover:bg-indigo-500/20 rounded-md transition-colors"
                        >
                            <XSquare size={14} /> Unselect All
                        </button>
                        <button 
                            onClick={async () => {
                                const confirmed = await ConfirmDialog.call({
                                    title: "Delete Items",
                                    message: `Are you sure you want to delete ${selectedFiles.size} items?`
                                });
                                if (!confirmed) return;
                                
                                for (const name of selectedFiles) {
                                    const entry = entries.find(e => e.name === name);
                                    if (entry) {
                                        const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
                                        try {
                                            await tauriBridge.sftpDelete(fullPath, entry.is_dir);
                                        } catch(e) {
                                            console.error(e);
                                        }
                                    }
                                }
                                fetchDir(currentPath);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded-md transition-colors border border-red-500/20"
                        >
                            <Trash2 size={14} /> Delete Selected
                        </button>
                    </div>
                </div>
            )}

            {/* Error banner */}
            {error && (
                <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* File List */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-zinc-500 uppercase bg-zinc-950/50 sticky top-0">
                        <tr>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium w-24">Size</th>
                            <th className="px-4 py-3 font-medium w-48">Modified</th>
                            <th className="px-4 py-3 font-medium w-20 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                        {entries.length === 0 && !loading && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                                    This directory is empty.
                                </td>
                            </tr>
                        )}
                        {entries.map((entry, idx) => {
                            const isSelected = selectedFiles.has(entry.name);
                            return (
                                <tr 
                                    key={`${entry.name}-${idx}`} 
                                    onClick={(e) => handleNavigate(e, entry)}
                                    className={`cursor-pointer transition-colors group ${isSelected ? 'bg-indigo-500/20' : 'hover:bg-zinc-800/50'}`}
                                >
                                    <td className="px-4 py-2.5 font-medium text-zinc-200 flex items-center gap-3">
                                        {entry.is_dir ? (
                                            <Folder size={16} className="text-indigo-400" />
                                        ) : (
                                            <FileText size={16} className="text-zinc-400" />
                                        )}
                                        {entry.name}
                                    </td>
                                    <td className="px-4 py-2.5 text-zinc-400 text-xs font-mono">
                                        {!entry.is_dir ? formatBytes(entry.size) : '--'}
                                    </td>
                                    <td className="px-4 py-2.5 text-zinc-400 text-xs">
                                        {formatDate(entry.modified)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => handleDelete(e, entry)}
                                                className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
