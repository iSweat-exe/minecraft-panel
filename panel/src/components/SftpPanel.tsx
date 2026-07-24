import React from 'react';
import { useLocation } from 'react-router-dom';
import { useSftp } from '../hooks/useSftp';
import { Upload, Copy, Scissors, XSquare, Trash2, Edit, CheckSquare } from 'lucide-react';
import { FileEditor } from './FileEditor';
import { UploadModal } from './dialogs/UploadModal';
import { ConfirmDialog } from './dialogs/ConfirmDialog';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { tauriBridge } from '../lib/tauriBridge';
import { SftpToolbar } from './sftp/SftpToolbar';
import { SftpFileList } from './sftp/SftpFileList';
import { useModsStore } from '../store/modsStore';
import { logAction } from '../lib/actionLogger';

export const SftpPanel: React.FC = () => {
    const location = useLocation();
    const initialPath = location.state?.initialPath || '/';
    const sftp = useSftp(initialPath);
    const { modPath } = useModsStore();
    
    // Normalize paths for comparison
    const normCurrent = sftp.currentPath.replace(/^\//, '').replace(/\/$/, '');
    const normMod = modPath.replace(/^\//, '').replace(/\/$/, '');
    const isModsFolder = normCurrent === normMod || (normMod.length > 0 && normCurrent.endsWith(normMod));

    const getCredentials = () => {
        const host = localStorage.getItem('node_host');
        const port = localStorage.getItem('node_port') || '8080';
        const token = localStorage.getItem('node_token');
        if (!host || !token) throw new Error("Daemon credentials missing");
        return { nodeUrl: `http://${host}:${port}`, token };
    };

    if (sftp.editingFile) {
        return (
            <FileEditor 
                path={sftp.editingFile.path} 
                initialContent={sftp.editingFile.content}
                onSave={sftp.saveEditor}
                onCancel={() => sftp.setEditingFile(null)}
            />
        );
    }

    return (
        <Card className="h-full flex flex-col overflow-hidden border-0 relative">
            {/* Drop zone overlay */}
            {sftp.isDragging && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary/50 rounded-xl">
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                        <div className="p-5 bg-primary/10 rounded-2xl border border-primary/30">
                            <Upload size={40} className="text-primary" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-foreground">Déposez vos fichiers ici</p>
                            <p className="text-sm text-muted-foreground mt-1">dans <span className="text-primary font-mono">{sftp.currentPath}</span></p>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload modal */}
            {sftp.uploadFiles && (
                <UploadModal
                    files={sftp.uploadFiles}
                    onCancel={(index) => {
                        sftp.setUploadFiles(prev => {
                            if (!prev) return null;
                            const next = [...prev];
                            next[index] = { ...next[index], status: 'cancelled' };
                            return next;
                        });
                    }}
                    onResolveConflict={sftp.resolveConflict}
                    onUndoCancel={sftp.undoCancel}
                    onSkipAllConflicts={sftp.skipAllConflicts}
                    onContinue={() => {
                        sftp.setUploadFiles(null);
                        sftp.fetchDir(sftp.currentPath);
                    }}
                    onClose={() => {
                        sftp.setUploadFiles(null);
                        sftp.fetchDir(sftp.currentPath);
                    }}
                />
            )}

            {/* Toolbar */}
            <SftpToolbar
                currentPath={sftp.currentPath}
                entries={sftp.entries}
                loading={sftp.loading}
                searchQuery={sftp.searchQuery}
                setSearchQuery={sftp.setSearchQuery}
                onNavigateUp={sftp.handleNavigateUp}
                onNavigateHome={() => sftp.fetchDir('/')}
                onNavigate={(path) => sftp.fetchDir(path)}
                onMkfile={sftp.handleMkfile}
                onMkdir={sftp.handleMkdir}
                onRefresh={() => sftp.fetchDir(sftp.currentPath)}
            />

            {/* Multi-selection Action Bar */}
            {sftp.selectedFiles.size > 0 && (
                <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
                    <span className="text-sm text-primary font-medium">
                        {sftp.selectedFiles.size} item{sftp.selectedFiles.size > 1 ? 's' : ''} selected
                    </span>
                    <div className="flex items-center gap-2">
                        {sftp.selectedFiles.size === 1 && (
                            <Button 
                                onClick={() => sftp.handleRename()}
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-primary border-primary/30 hover:bg-primary/20"
                            >
                                <Edit size={14} /> Rename
                            </Button>
                        )}
                        {sftp.clipboard && (
                            <Button 
                                onClick={() => sftp.handlePaste()}
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-success border-success/30 hover:bg-success/20"
                            >
                                <Copy size={14} /> Paste ({sftp.clipboard.files.length})
                            </Button>
                        )}
                        <Button 
                            onClick={() => sftp.handleCopyCut('copy')}
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-primary hover:text-primary-foreground hover:bg-primary/20"
                        >
                            <Copy size={14} /> Copy
                        </Button>
                        <Button 
                            onClick={() => sftp.handleCopyCut('cut')}
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-primary hover:text-primary-foreground hover:bg-primary/20"
                        >
                            <Scissors size={14} /> Cut
                        </Button>
                        <div className="w-px h-4 bg-primary/30 mx-1"></div>
                        <Button 
                            onClick={() => sftp.setSelectedFiles(new Set(sftp.entries.map(e => e.name)))}
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-primary hover:text-primary-foreground hover:bg-primary/20"
                        >
                            <CheckSquare size={14} /> Select All
                        </Button>
                        <Button 
                            onClick={() => sftp.setSelectedFiles(new Set())}
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-primary hover:text-primary-foreground hover:bg-primary/20"
                        >
                            <XSquare size={14} /> Unselect All
                        </Button>
                        <Button 
                            onClick={async () => {
                                const confirmed = await ConfirmDialog.call({
                                    title: "Delete Items",
                                    message: `Are you sure you want to delete ${sftp.selectedFiles.size} items?`
                                });
                                if (!confirmed) return;
                                
                                const { nodeUrl, token } = getCredentials();
                                for (const name of Array.from(sftp.selectedFiles)) {
                                    const entry = sftp.entries.find(e => e.name === name);
                                    if (entry) {
                                        const fullPath = sftp.currentPath === '/' ? `/${name}` : `${sftp.currentPath}/${name}`;
                                        try {
                                            await tauriBridge.nodeFileAction(nodeUrl, token, fullPath, "delete");
                                            logAction('Suppression de fichier', { file: fullPath });
                                        } catch(e) {
                                            console.error(e);
                                        }
                                    }
                                }
                                sftp.fetchDir(sftp.currentPath);
                            }}
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-danger border-danger/20 hover:bg-danger/20"
                        >
                            <Trash2 size={14} /> Delete Selected
                        </Button>
                    </div>
                </div>
            )}

            {/* Error banner */}
            {sftp.error && (
                <div className="px-4 py-2 bg-danger/10 border-b border-danger/20 text-danger text-sm">
                    {sftp.error}
                </div>
            )}

            {/* File List */}
            <SftpFileList
                entries={sftp.entries}
                loading={sftp.loading}
                selectedFiles={sftp.selectedFiles}
                sortConfig={sftp.sortConfig}
                onSort={(key) => {
                    sftp.setSortConfig(prev => {
                        if (prev.key === key) {
                            return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
                        }
                        return { key, direction: 'asc' };
                    });
                }}
                onNavigate={sftp.handleNavigate}
                onDelete={sftp.handleDelete}
                onToggleSelect={(entry) => {
                    sftp.setSelectedFiles(prev => {
                        const next = new Set(prev);
                        if (next.has(entry.name)) {
                            next.delete(entry.name);
                        } else {
                            next.add(entry.name);
                        }
                        return next;
                    });
                }}
                isModsFolder={isModsFolder}
                currentPath={sftp.currentPath}
                onRenameFile={async (oldName, newName) => {
                    const oldPath = sftp.currentPath === '/' ? `/${oldName}` : `${sftp.currentPath}/${oldName}`;
                    const newPath = sftp.currentPath === '/' ? `/${newName}` : `${sftp.currentPath}/${newName}`;
                    try {
                        const { nodeUrl, token } = getCredentials();
                        await tauriBridge.nodeFileAction(nodeUrl, token, oldPath, { rename: { new_name: newPath } });
                        logAction('Renommage de fichier', { old: oldPath, new: newPath });
                        sftp.fetchDir(sftp.currentPath);
                    } catch (e) {
                        console.error('Failed to rename file:', e);
                    }
                }}
                onRefresh={() => sftp.fetchDir(sftp.currentPath)}
            />
        </Card>
    );
};

