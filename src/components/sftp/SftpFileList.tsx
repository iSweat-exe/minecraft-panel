import React from 'react';
import { FileEntry } from '../../lib/tauriBridge';
import { Folder, FileText, Trash2 } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';

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
        <div className="flex-1 overflow-auto custom-scrollbar">
            <Table>
                <TableHeader className="sticky top-0 bg-zinc-950/90 backdrop-blur z-10">
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-24">Size</TableHead>
                        <TableHead className="w-48">Modified</TableHead>
                        <TableHead className="w-20 text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {entries.length === 0 && !loading && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                This directory is empty.
                            </TableCell>
                        </TableRow>
                    )}
                    {entries.map((entry, idx) => {
                        const isSelected = selectedFiles.has(entry.name);
                        return (
                            <TableRow 
                                key={`${entry.name}-${idx}`} 
                                onClick={(e) => onNavigate(e, entry)}
                                className={`cursor-pointer group ${isSelected ? 'bg-primary/20 hover:bg-primary/30' : ''}`}
                            >
                                <TableCell className="font-medium text-foreground">
                                    <div className="flex items-center gap-3">
                                        {entry.is_dir ? (
                                            <Folder size={16} className="text-warning" />
                                        ) : (
                                            <FileText size={16} className="text-muted-foreground" />
                                        )}
                                        {entry.name}
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs font-mono">
                                    {!entry.is_dir ? formatBytes(entry.size) : '--'}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                    {formatDate(entry.modified)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => onDelete(e, entry)}
                                            className="p-1 text-muted-foreground hover:text-danger transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};
