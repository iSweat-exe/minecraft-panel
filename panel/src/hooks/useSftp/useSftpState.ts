import { useState, useEffect, useRef, useMemo } from 'react';
import { tauriBridge, FileEntry } from '../../lib/tauriBridge';
import { SftpStateContext } from './types';

export function useSftpState(initialPath: string = '/minecraft') {
    const [currentPath, setCurrentPath] = useState<string>(initialPath);
    const [rawEntries, setRawEntries] = useState<FileEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: 'name'|'size'|'modified', direction: 'asc'|'desc' }>({ key: 'name', direction: 'asc' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const entries = useMemo(() => {
        let filtered = rawEntries;
        if (searchQuery.trim()) {
            const lowerQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(e => e.name.toLowerCase().includes(lowerQuery));
        }
        
        return [...filtered].sort((a, b) => {
            if (a.is_dir !== b.is_dir) {
                return a.is_dir ? -1 : 1;
            }
            
            let comparison = 0;
            if (sortConfig.key === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else if (sortConfig.key === 'size') {
                comparison = a.size - b.size;
            } else if (sortConfig.key === 'modified') {
                comparison = a.modified - b.modified;
            }
            
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [rawEntries, searchQuery, sortConfig]);

    const stateRef = useRef({ currentPath, entries: rawEntries });
    
    useEffect(() => {
        stateRef.current = { currentPath, entries: rawEntries };
    }, [currentPath, rawEntries]);

    useEffect(() => {
        fetchDir(initialPath);
    }, [initialPath]);

    const fetchDir = async (path: string) => {
        setLoading(true);
        setError(null);
        try {
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            if (!host || !token) throw new Error("Daemon credentials missing");
            const nodeUrl = `http://${host}:${port}`;

            const data = await tauriBridge.nodeListDir(nodeUrl, token, path);
            setRawEntries(data);
            setCurrentPath(path);
        } catch (e: any) {
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    };

    const stateContext: SftpStateContext = {
        currentPath,
        entries,
        rawEntries,
        loading,
        error,
        setError,
        fetchDir,
        stateRef
    };

    return {
        stateContext,
        searchQuery,
        setSearchQuery,
        sortConfig,
        setSortConfig
    };
}

