import { useState, useCallback, useEffect } from 'react';
import { tauriBridge } from '../../lib/tauriBridge';
import { UploadFileItem } from '../../components/dialogs/UploadModal';
import { SftpStateContext } from './types';

export function useSftpUpload(state: SftpStateContext) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<UploadFileItem[] | null>(null);

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
            const { entries: ce } = state.stateRef.current;
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
    }, [processUploads, state.stateRef]);

    const skipAllConflicts = useCallback(() => {
        setUploadFiles(prev => {
            if (!prev) return null;
            return prev.map(f => f.status === 'conflict' ? { ...f, status: 'cancelled' } : f);
        });
    }, []);

    useEffect(() => {
        state.fetchDir(state.currentPath);

        let unlistenDrop: () => void;
        let unlistenProgress: () => void;

        tauriBridge.onFileDrop({
            onDrop: (paths) => {
                if (!paths || paths.length === 0) return;
                const { currentPath: cp, entries: ce } = state.stateRef.current;

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
        // We only want to run this once to setup listeners, fetchDir handles its own state
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [processUploads]); // state.fetchDir and state.currentPath and stateRef shouldn't trigger re-bind

    return {
        isDragging,
        uploadFiles,
        setUploadFiles,
        resolveConflict,
        undoCancel,
        skipAllConflicts
    };
}
