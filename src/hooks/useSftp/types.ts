import { FileEntry } from '../../lib/tauriBridge';

export interface SftpStateContext {
    currentPath: string;
    entries: FileEntry[];
    rawEntries: FileEntry[];
    loading: boolean;
    error: string | null;
    setError: (err: string | null) => void;
    fetchDir: (path: string) => Promise<void>;
    stateRef: React.MutableRefObject<{ currentPath: string; entries: FileEntry[] }>;
}

export interface SftpSelectionContext {
    selectedFiles: Set<string>;
    setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
    clipboard: { action: 'copy' | 'cut'; files: string[]; path: string } | null;
    setClipboard: React.Dispatch<React.SetStateAction<{ action: 'copy' | 'cut'; files: string[]; path: string } | null>>;
}
