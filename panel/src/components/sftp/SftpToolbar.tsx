import React from 'react';
import { CornerLeftUp, Home, ChevronRight, Folder, FileText, FolderPlus, RefreshCw } from 'lucide-react';
import { FileEntry } from '../../lib/tauriBridge';
import { SearchInput } from '../ui/SearchInput';

interface SftpToolbarProps {
    currentPath: string;
    entries: FileEntry[];
    loading: boolean;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    onNavigateUp: () => void;
    onNavigateHome: () => void;
    onNavigate: (path: string) => void;
    onMkfile: () => void;
    onMkdir: () => void;
    onRefresh: () => void;
}

export const SftpToolbar: React.FC<SftpToolbarProps> = ({
    currentPath,
    entries,
    loading,
    searchQuery,
    setSearchQuery,
    onNavigateUp,
    onNavigateHome,
    onNavigate,
    onMkfile,
    onMkdir,
    onRefresh
}) => {
    return (
        <div className="p-3 border-b border-border flex items-center justify-between bg-surface/50 gap-4">
            <div className="flex items-center gap-2 overflow-hidden text-sm flex-1">
                <button 
                    onClick={onNavigateUp}
                    disabled={currentPath === '/'}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded transition-colors disabled:opacity-50"
                >
                    <CornerLeftUp size={16} />
                </button>
                {/* Premium Breadcrumb */}
                <div className="flex-1 flex items-center bg-background/50 rounded-lg border border-border/80 px-2 py-1.5 overflow-hidden shadow-inner">
                    <button
                        onClick={onNavigateHome}
                        className={`p-1 rounded-md transition-colors shrink-0 ${currentPath === '/' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover'}`}
                        title="Racine (Root)"
                    >
                        <Home size={14} />
                    </button>
                    
                    {currentPath.split('/').filter(Boolean).map((part, index, arr) => {
                        const pathToHere = '/' + arr.slice(0, index + 1).join('/');
                        const isLast = index === arr.length - 1;
                        return (
                            <React.Fragment key={pathToHere}>
                                <ChevronRight size={14} className="text-muted-foreground mx-0.5 shrink-0" />
                                <button
                                    onClick={() => onNavigate(pathToHere)}
                                    className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors truncate max-w-[120px] sm:max-w-[200px] ${
                                        isLast 
                                            ? 'text-foreground bg-surface-hover' 
                                            : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover/50'
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
                    <div className="hidden md:flex items-center gap-3 ml-3 px-3 py-1.5 bg-background/50 rounded-lg border border-border/80 text-[11px] text-muted-foreground whitespace-nowrap shadow-inner">
                        <div className="flex items-center gap-1.5">
                            <Folder size={12} className="text-warning/80" />
                            <span>{entries.filter(e => e.is_dir).length} dossier{entries.filter(e => e.is_dir).length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-border"></div>
                        <div className="flex items-center gap-1.5">
                            <FileText size={12} className="text-primary/80" />
                            <span>{entries.filter(e => !e.is_dir).length} fichier{entries.filter(e => !e.is_dir).length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-border"></div>
                        <div className="font-medium text-foreground">
                            {entries.length} total
                        </div>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Rechercher..."
                    className="w-48 mr-2"
                />
                <button onClick={onMkfile} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-surface-hover rounded transition-colors" title="New File">
                    <FileText size={16} />
                </button>
                <button onClick={onMkdir} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-surface-hover rounded transition-colors" title="New Folder">
                    <FolderPlus size={16} />
                </button>
                <button onClick={onRefresh} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded transition-colors" title="Refresh">
                    <RefreshCw size={16} className={loading ? 'animate-spin text-primary' : ''} />
                </button>
            </div>
        </div>
    );
};
