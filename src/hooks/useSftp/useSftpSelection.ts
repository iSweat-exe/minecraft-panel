import { useState } from 'react';
import { SftpStateContext, SftpSelectionContext } from './types';
import { tauriBridge } from '../../lib/tauriBridge';
import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { PromptDialog } from '../../components/dialogs/PromptDialog';
import { logAction } from '../../lib/actionLogger';

export function useSftpSelection(state: SftpStateContext) {
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [clipboard, setClipboard] = useState<{ action: 'copy' | 'cut'; files: string[]; path: string } | null>(null);

    const handleCopyCut = (action: 'copy' | 'cut') => {
        if (selectedFiles.size === 0) return;
        setClipboard({ action, files: Array.from(selectedFiles), path: state.currentPath });
        if (action === 'cut') setSelectedFiles(new Set());
    };

    const handleRename = async () => {
        if (selectedFiles.size !== 1) return;
        const currentName = Array.from(selectedFiles)[0];
        
        const newName = await PromptDialog.call({
            title: "Renommer :",
            defaultValue: currentName
        });
        
        if (!newName || newName === currentName) return;
        
        if (state.rawEntries.some(e => e.name === newName)) {
            state.setError(`A file or folder named ${newName} already exists.`);
            return;
        }

        const oldPath = state.currentPath === '/' ? `/${currentName}` : `${state.currentPath}/${currentName}`;
        const newPath = state.currentPath === '/' ? `/${newName}` : `${state.currentPath}/${newName}`;
        
        try {
            await tauriBridge.sftpRename(oldPath, newPath);
            logAction('Renommage de fichier', { old: oldPath, new: newPath });
            setSelectedFiles(new Set());
            state.fetchDir(state.currentPath);
        } catch (err: any) {
            state.setError(`Rename failed: ${err.toString()}`);
        }
    };

    const handlePaste = async () => {
        if (!clipboard) return;
        try {
            for (const file of clipboard.files) {
                if (state.entries.some(e => e.name === file)) {
                    const confirmed = await ConfirmDialog.call({
                        title: "File exists",
                        message: `The file ${file} already exists. Do you want to overwrite it?`
                    });
                    if (!confirmed) continue;
                }

                const srcPath = clipboard.path === '/' ? `/${file}` : `${clipboard.path}/${file}`;
                const dstPath = state.currentPath === '/' ? `/${file}` : `${state.currentPath}/${file}`;
                
                if (clipboard.action === 'copy') {
                    await tauriBridge.sshCopy(srcPath, dstPath);
                    logAction('Copie de fichier', { src: srcPath, dst: dstPath });
                } else {
                    await tauriBridge.sftpRename(srcPath, dstPath);
                    logAction('Déplacement de fichier', { src: srcPath, dst: dstPath });
                }
            }
            if (clipboard.action === 'cut') {
                setClipboard(null);
            }
            state.fetchDir(state.currentPath);
        } catch (e: any) {
            state.setError(`Paste failed: ${e.toString()}`);
        }
    };

    const selectionContext: SftpSelectionContext = {
        selectedFiles,
        setSelectedFiles,
        clipboard,
        setClipboard
    };

    return {
        selectionContext,
        handleCopyCut,
        handleRename,
        handlePaste
    };
}
