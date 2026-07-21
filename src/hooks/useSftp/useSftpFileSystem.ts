import { useState } from 'react';
import { tauriBridge, FileEntry } from '../../lib/tauriBridge';
import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { PromptDialog } from '../../components/dialogs/PromptDialog';
import { SftpStateContext, SftpSelectionContext } from './types';

export function useSftpFileSystem(state: SftpStateContext, selection: SftpSelectionContext) {
    const [editingFile, setEditingFile] = useState<{path: string, content: string} | null>(null);

    const handleNavigate = (e: React.MouseEvent, entry: FileEntry) => {
        if (e.ctrlKey || e.metaKey) {
            e.stopPropagation();
            const newSelected = new Set(selection.selectedFiles);
            if (newSelected.has(entry.name)) {
                newSelected.delete(entry.name);
            } else {
                newSelected.add(entry.name);
            }
            selection.setSelectedFiles(newSelected);
            return;
        }

        if (entry.is_dir) {
            selection.setSelectedFiles(new Set()); // Reset selection on navigate
            const newPath = state.currentPath === '/' ? `/${entry.name}` : `${state.currentPath}/${entry.name}`;
            state.fetchDir(newPath);
        } else {
            openEditor(entry.name);
        }
    };

    const handleNavigateUp = () => {
        if (state.currentPath === '/') return;
        const parts = state.currentPath.split('/');
        parts.pop();
        const newPath = parts.join('/') || '/';
        selection.setSelectedFiles(new Set()); // Reset selection on navigate
        state.fetchDir(newPath);
    };

    const openEditor = async (filename: string) => {
        const fullPath = state.currentPath === '/' ? `/${filename}` : `${state.currentPath}/${filename}`;
        try {
            const content = await tauriBridge.sftpReadFile(fullPath);
            setEditingFile({ path: fullPath, content });
        } catch (e: any) {
            state.setError(`Cannot read file: ${e.toString()}`);
        }
    };

    const saveEditor = async (content: string) => {
        if (!editingFile) return;
        try {
            await tauriBridge.sftpWriteFile(editingFile.path, content);
            setEditingFile(null);
            state.fetchDir(state.currentPath);
        } catch (e: any) {
            state.setError(`Cannot save file: ${e.toString()}`);
        }
    };

    const handleDelete = async (e: React.MouseEvent, entry: FileEntry) => {
        e.stopPropagation();
        const confirmed = await ConfirmDialog.call({ 
            title: "Delete File",
            message: `Are you sure you want to delete ${entry.name}?` 
        });
        if (!confirmed) return;
        
        const fullPath = state.currentPath === '/' ? `/${entry.name}` : `${state.currentPath}/${entry.name}`;
        try {
            await tauriBridge.sftpDelete(fullPath, entry.is_dir);
            state.fetchDir(state.currentPath);
        } catch (err: any) {
            state.setError(`Delete failed: ${err.toString()}`);
        }
    };

    const handleMkdir = async () => {
        const name = await PromptDialog.call({
            title: "Directory name:"
        });
        if (!name) return;
        
        if (state.entries.some(e => e.name === name)) {
            state.setError(`A file or folder named ${name} already exists.`);
            return;
        }

        const fullPath = state.currentPath === '/' ? `/${name}` : `${state.currentPath}/${name}`;
        try {
            await tauriBridge.sftpMkdir(fullPath);
            state.fetchDir(state.currentPath);
        } catch (err: any) {
            state.setError(`Mkdir failed: ${err.toString()}`);
        }
    };

    const handleMkfile = async () => {
        const name = await PromptDialog.call({
            title: "File name:"
        });
        if (!name) return;
        
        if (state.entries.some(e => e.name === name)) {
            const confirmed = await ConfirmDialog.call({
                title: "File exists",
                message: `The file ${name} already exists. Do you want to overwrite it?`
            });
            if (!confirmed) return;
        }

        const fullPath = state.currentPath === '/' ? `/${name}` : `${state.currentPath}/${name}`;
        try {
            await tauriBridge.sftpWriteFile(fullPath, "");
            state.fetchDir(state.currentPath);
        } catch (err: any) {
            state.setError(`Create file failed: ${err.toString()}`);
        }
    };

    return {
        editingFile,
        setEditingFile,
        handleNavigate,
        handleNavigateUp,
        openEditor,
        saveEditor,
        handleDelete,
        handleMkdir,
        handleMkfile
    };
}
