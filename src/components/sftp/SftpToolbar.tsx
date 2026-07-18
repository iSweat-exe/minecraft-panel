import React from 'react';
import { CornerLeftUp, Home, ChevronRight, Folder, FileText, FolderPlus, RefreshCw } from 'lucide-react';
import { FileEntry } from '../../lib/tauriBridge';

interface SftpToolbarProps {
    currentPath: string;
    entries: FileEntry[];
    loading: boolean;
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
    onNavigateUp,
    onNavigateHome,
    onNavigate,
    onMkfile,
    onMkdir,
    onRefresh
}) => {
    return (
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
            <div className="flex items-center gap-2 overflow-hidden text-sm">
                <button 
                    onClick={onNavigateUp}
                    disabled={currentPath === '/'}
                    className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
                >
                    <CornerLeftUp size={16} />
                </button>
                {/* Premium Breadcrumb */}
                <div className="flex-1 flex items-center bg-zinc-950/50 rounded-lg border border-zinc-800/80 px-2 py-1.5 overflow-hidden shadow-inner">
                    <button
                        onClick={onNavigateHome}
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
                                    onClick={() => onNavigate(pathToHere)}
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
                <button onClick={onMkfile} className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded transition-colors" title="New File">
                    <FileText size={16} />
                </button>
                <button onClick={onMkdir} className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded transition-colors" title="New Folder">
                    <FolderPlus size={16} />
                </button>
                <button onClick={onRefresh} className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors" title="Refresh">
                    <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-400' : ''} />
                </button>
            </div>
        </div>
    );
};
