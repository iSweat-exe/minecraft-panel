import { useState, useEffect, useRef, useCallback } from 'react';
import { tauriBridge, FileEntry } from '../lib/tauriBridge';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { PromptDialog } from '../components/dialogs/PromptDialog';
import { UploadFileItem } from '../components/dialogs/UploadModal'; // We will adjust paths as needed

export function useSftp() {
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

            // Skip non-pending files
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
            
            if (!exists) {
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

    const handleCopyCut = (action: 'copy' | 'cut') => {
        if (selectedFiles.size === 0) return;
        setClipboard({ action, files: Array.from(selectedFiles), path: currentPath });
        if (action === 'cut') setSelectedFiles(new Set());
    };

    const handlePaste = async () => {
        if (!clipboard) return;
        try {
            if (clipboard.action === 'copy') {
                for (const file of clipboard.files) {
                    const srcPath = clipboard.path === '/' ? `/${file}` : `${clipboard.path}/${file}`;
                    const dstPath = currentPath === '/' ? `/${file}` : `${currentPath}/${file}`;
                    await tauriBridge.sftpRename(srcPath, dstPath); // For now it uses rename, but ideally we would have copy. SftpPanel currently did this incorrectly.
                }
            } else {
                for (const file of clipboard.files) {
                    const srcPath = clipboard.path === '/' ? `/${file}` : `${clipboard.path}/${file}`;
                    const dstPath = currentPath === '/' ? `/${file}` : `${currentPath}/${file}`;
                    await tauriBridge.sftpRename(srcPath, dstPath);
                }
                setClipboard(null);
            }
            fetchDir(currentPath);
        } catch (e: any) {
            setError(`Paste failed: ${e.toString()}`);
        }
    };

    return {
        currentPath,
        entries,
        loading,
        error,
        selectedFiles,
        setSelectedFiles,
        clipboard,
        editingFile,
        setEditingFile,
        isDragging,
        uploadFiles,
        setUploadFiles,
        fetchDir,
        resolveConflict,
        undoCancel,
        handleNavigate,
        handleNavigateUp,
        saveEditor,
        handleDelete,
        handleMkdir,
        handleMkfile,
        handleCopyCut,
        handlePaste
    };
}
