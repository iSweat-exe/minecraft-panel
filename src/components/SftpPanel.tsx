import React from 'react';
import { useSftp } from '../hooks/useSftp';
import { Upload, Copy, Scissors, XSquare, Trash2 } from 'lucide-react';
import { FileEditor } from './FileEditor';
import { UploadModal } from './dialogs/UploadModal';
import { ConfirmDialog } from './dialogs/ConfirmDialog';
import { tauriBridge } from '../lib/tauriBridge';
import { SftpToolbar } from './sftp/SftpToolbar';
import { SftpFileList } from './sftp/SftpFileList';

export const SftpPanel: React.FC = () => {
    const sftp = useSftp();

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
        <div className="h-full flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm relative">
            {/* Drop zone overlay */}
            {sftp.isDragging && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm border-2 border-dashed border-indigo-500/50 rounded-xl">
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                        <div className="p-5 bg-indigo-500/10 rounded-2xl border border-indigo-500/30">
                            <Upload size={40} className="text-indigo-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-zinc-100">Déposez vos fichiers ici</p>
                            <p className="text-sm text-zinc-500 mt-1">dans <span className="text-indigo-400 font-mono">{sftp.currentPath}</span></p>
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
                    onContinue={() => {
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
                onNavigateUp={sftp.handleNavigateUp}
                onNavigateHome={() => sftp.fetchDir('/')}
                onNavigate={(path) => sftp.fetchDir(path)}
                onMkfile={sftp.handleMkfile}
                onMkdir={sftp.handleMkdir}
                onRefresh={() => sftp.fetchDir(sftp.currentPath)}
            />

            {/* Multi-selection Action Bar */}
            {sftp.selectedFiles.size > 0 && (
                <div className="px-4 py-2 bg-indigo-900/30 border-b border-indigo-500/30 flex items-center justify-between">
                    <span className="text-sm text-indigo-300 font-medium">
                        {sftp.selectedFiles.size} item{sftp.selectedFiles.size > 1 ? 's' : ''} selected
                    </span>
                    <div className="flex items-center gap-2">
                        {sftp.clipboard && (
                            <button 
                                onClick={async () => {
                                    for (const file of sftp.clipboard!.files) {
                                        if (sftp.entries.some(e => e.name === file)) {
                                            const confirmed = await ConfirmDialog.call({
                                                title: "File exists",
                                                message: `The file ${file} already exists. Do you want to overwrite it?`
                                            });
                                            if (!confirmed) continue;
                                        }

                                        const src = sftp.clipboard!.path === '/' ? `/${file}` : `${sftp.clipboard!.path}/${file}`;
                                        const dest = sftp.currentPath === '/' ? `/${file}` : `${sftp.currentPath}/${file}`;
                                        try {
                                            if (sftp.clipboard!.action === 'cut') {
                                                await tauriBridge.sftpRename(src, dest);
                                            } else {
                                                await tauriBridge.sshCopy(src, dest);
                                            }
                                        } catch (e: any) {
                                            console.error(`Paste failed: ${e.toString()}`);
                                        }
                                    }
                                    if (sftp.clipboard!.action === 'cut') {
                                        // Should be done inside a hook method ideally, but quick patch here
                                    }
                                    sftp.handlePaste(); // This covers fetchDir too
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium rounded-md transition-colors border border-emerald-500/30"
                            >
                                <Copy size={14} /> Paste ({sftp.clipboard.files.length})
                            </button>
                        )}
                        <button 
                            onClick={() => sftp.handleCopyCut('copy')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-white hover:bg-indigo-500/20 rounded-md transition-colors"
                        >
                            <Copy size={14} /> Copy
                        </button>
                        <button 
                            onClick={() => sftp.handleCopyCut('cut')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-white hover:bg-indigo-500/20 rounded-md transition-colors"
                        >
                            <Scissors size={14} /> Cut
                        </button>
                        <div className="w-px h-4 bg-indigo-500/30 mx-1"></div>
                        <button 
                            onClick={() => sftp.setSelectedFiles(new Set())}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-white hover:bg-indigo-500/20 rounded-md transition-colors"
                        >
                            <XSquare size={14} /> Unselect All
                        </button>
                        <button 
                            onClick={async () => {
                                const confirmed = await ConfirmDialog.call({
                                    title: "Delete Items",
                                    message: `Are you sure you want to delete ${sftp.selectedFiles.size} items?`
                                });
                                if (!confirmed) return;
                                
                                for (const name of Array.from(sftp.selectedFiles)) {
                                    const entry = sftp.entries.find(e => e.name === name);
                                    if (entry) {
                                        const fullPath = sftp.currentPath === '/' ? `/${name}` : `${sftp.currentPath}/${name}`;
                                        try {
                                            await tauriBridge.sftpDelete(fullPath, entry.is_dir);
                                        } catch(e) {
                                            console.error(e);
                                        }
                                    }
                                }
                                sftp.fetchDir(sftp.currentPath);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded-md transition-colors border border-red-500/20"
                        >
                            <Trash2 size={14} /> Delete Selected
                        </button>
                    </div>
                </div>
            )}

            {/* Error banner */}
            {sftp.error && (
                <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">
                    {sftp.error}
                </div>
            )}

            {/* File List */}
            <SftpFileList
                entries={sftp.entries}
                loading={sftp.loading}
                selectedFiles={sftp.selectedFiles}
                onNavigate={sftp.handleNavigate}
                onDelete={sftp.handleDelete}
            />
        </div>
    );
};
