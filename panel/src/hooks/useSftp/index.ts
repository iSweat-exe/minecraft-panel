import { useSftpState } from './useSftpState';
import { useSftpSelection } from './useSftpSelection';
import { useSftpFileSystem } from './useSftpFileSystem';
import { useSftpUpload } from './useSftpUpload';

export function useSftp(initialPath: string = '/') {
    const sftpState = useSftpState(initialPath);
    const selection = useSftpSelection(sftpState.stateContext);
    const fileSystem = useSftpFileSystem(sftpState.stateContext, selection.selectionContext);
    const upload = useSftpUpload(sftpState.stateContext);

    return {
        // State
        currentPath: sftpState.stateContext.currentPath,
        entries: sftpState.stateContext.entries,
        loading: sftpState.stateContext.loading,
        error: sftpState.stateContext.error,
        searchQuery: sftpState.searchQuery,
        setSearchQuery: sftpState.setSearchQuery,
        sortConfig: sftpState.sortConfig,
        setSortConfig: sftpState.setSortConfig,
        fetchDir: sftpState.stateContext.fetchDir,

        // Selection
        selectedFiles: selection.selectionContext.selectedFiles,
        setSelectedFiles: selection.selectionContext.setSelectedFiles,
        clipboard: selection.selectionContext.clipboard,
        handleCopyCut: selection.handleCopyCut,
        handleRename: selection.handleRename,
        handlePaste: selection.handlePaste,

        // FileSystem
        editingFile: fileSystem.editingFile,
        setEditingFile: fileSystem.setEditingFile,
        handleNavigate: fileSystem.handleNavigate,
        handleNavigateUp: fileSystem.handleNavigateUp,
        saveEditor: fileSystem.saveEditor,
        handleDelete: fileSystem.handleDelete,
        handleMkdir: fileSystem.handleMkdir,
        handleMkfile: fileSystem.handleMkfile,

        // Upload
        isDragging: upload.isDragging,
        uploadFiles: upload.uploadFiles,
        setUploadFiles: upload.setUploadFiles,
        resolveConflict: upload.resolveConflict,
        undoCancel: upload.undoCancel,
        skipAllConflicts: upload.skipAllConflicts
    };
}
