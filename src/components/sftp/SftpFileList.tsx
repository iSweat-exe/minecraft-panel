import React from 'react';
import { FileEntry } from '../../lib/tauriBridge';
import { Folder, FileText, Trash2 } from 'lucide-react';

interface SftpFileListProps {
    entries: FileEntry[];
    loading: boolean;
    selectedFiles: Set<string>;
    onNavigate: (e: React.MouseEvent, entry: FileEntry) => void;
    onDelete: (e: React.MouseEvent, entry: FileEntry) => void;
}

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

export const SftpFileList: React.FC<SftpFileListProps> = ({
    entries,
    loading,
    selectedFiles,
    onNavigate,
    onDelete
}) => {
    return (
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
                                onClick={(e) => onNavigate(e, entry)}
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
                                            onClick={(e) => onDelete(e, entry)}
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
    );
};
