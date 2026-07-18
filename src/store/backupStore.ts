import { create } from 'zustand';
import { save, open } from '@tauri-apps/plugin-dialog';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from './connectionStore';

export interface BackupProgress {
    filename: string;
    written: number;
    total: number;
}

interface BackupStore {
    loading: boolean;
    success: boolean;
    statusText: string;
    error: string | null;
    progress: BackupProgress | null;
    speed: number;
    eta: number;
    
    _lastProgress: { timestamp: number; written: number } | null;

    setLoading: (loading: boolean) => void;
    setStatusText: (text: string) => void;
    setError: (error: string | null) => void;
    
    handleProgressUpdate: (p: BackupProgress) => void;
    clearProgress: () => void;

    createBackup: () => Promise<void>;
    restoreBackup: () => Promise<void>;
    cancelBackup: () => Promise<void>;
}

export const useBackupStore = create<BackupStore>((set, get) => ({
    loading: false,
    success: false,
    statusText: '',
    error: null,
    progress: null,
    speed: 0,
    eta: 0,
    
    _lastProgress: null,

    setLoading: (loading) => set({ loading }),
    setStatusText: (text) => set({ statusText: text }),
    setError: (error) => set({ error }),

    handleProgressUpdate: (p) => {
        const state = get();
        const now = Date.now();
        let newSpeed = state.speed;
        let newLastProgress = state._lastProgress;

        if (state._lastProgress) {
            const elapsed = now - state._lastProgress.timestamp;
            if (elapsed > 500) {
                const diff = p.written - state._lastProgress.written;
                newSpeed = diff / (elapsed / 1000);
                newLastProgress = { timestamp: now, written: p.written };
            }
        } else {
            newLastProgress = { timestamp: now, written: p.written };
            newSpeed = 0;
        }

        let newEta = 0;
        if (newSpeed > 0) {
            newEta = (p.total - p.written) / newSpeed;
        }

        set({
            progress: p,
            speed: newSpeed,
            eta: newEta,
            _lastProgress: newLastProgress
        });
    },

    clearProgress: () => set({
        progress: null,
        speed: 0,
        eta: 0,
        _lastProgress: null
    }),

    createBackup: async () => {
        const { sshStatus } = useConnectionStore.getState();
        if (sshStatus !== 'connected') return;

        try {
            set({ error: null });
            
            const now = new Date();
            const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-mm-ss

            const defaultName = `minecraft_backup_${date}_${time}.tar.gz`;
            
            const localPath = await save({
                filters: [{ name: 'Archive tar.gz', extensions: ['tar.gz'] }],
                defaultPath: defaultName,
                title: 'Sauvegarder le monde Minecraft'
            });

            if (!localPath) return;

            set({ loading: true, success: false, statusText: 'Préparation de la sauvegarde...' });
            get().clearProgress();

            const output = await tauriBridge.sftpReadFile('/minecraft/server.properties').catch(() => "");
            const match = output.match(/^level-name=(.+)$/m);
            const worldName = match ? match[1].trim() : 'world';

            set({ statusText: 'Compression du monde sur le serveur...' });
            const remotePath = `/minecraft/${worldName}_backup.tar.gz`;
            const tarCmd = `cd /minecraft && tar -czf "${worldName}_backup.tar.gz" "${worldName}"`;
            
            await tauriBridge.sshExecute(tarCmd);

            set({ statusText: 'Téléchargement de la sauvegarde...' });
            await tauriBridge.sftpDownloadFile(remotePath, localPath);

            set({ statusText: 'Nettoyage...' });
            await tauriBridge.sftpDelete(remotePath, false);

            set({ statusText: 'Sauvegarde terminée avec succès !', success: true });
            setTimeout(() => set({ statusText: '', loading: false, success: false }), 3000);

        } catch (err: any) {
            console.error("Backup failed:", err);
            set({ error: err.toString(), loading: false, success: false, statusText: '' });
        }
    },

    restoreBackup: async () => {
        const { sshStatus } = useConnectionStore.getState();
        if (sshStatus !== 'connected') return;

        try {
            set({ error: null });
            
            const selected = await open({
                filters: [{ name: 'Archive tar.gz', extensions: ['tar.gz'] }],
                multiple: false,
                title: 'Restaurer une sauvegarde'
            });

            if (!selected) return;
            const localPath = selected as string;

            set({ loading: true, success: false, statusText: 'Arrêt du serveur...' });
            get().clearProgress();

            await tauriBridge.serviceAction('stop');

            set({ statusText: 'Envoi de la sauvegarde vers le serveur...' });
            const remotePath = '/minecraft/restore_backup.tar.gz';
            await tauriBridge.sftpUploadFile(localPath, remotePath);

            set({ statusText: 'Extraction de la sauvegarde...' });
            const tarCmd = `cd /minecraft && tar -xzf restore_backup.tar.gz`;
            await tauriBridge.sshExecute(tarCmd);

            set({ statusText: 'Nettoyage...' });
            await tauriBridge.sftpDelete(remotePath, false);

            set({ statusText: 'Restauration terminée ! Redémarrez le serveur manuellement.', success: true });
            setTimeout(() => set({ statusText: '', loading: false, success: false }), 4000);

        } catch (err: any) {
            console.error("Restore failed:", err);
            set({ error: err.toString(), loading: false, success: false, statusText: '' });
        }
    },

    cancelBackup: async () => {
        try {
            await tauriBridge.cancelBackup();
            set({ loading: false, success: false, statusText: 'Annulé par l\'utilisateur', error: null });
            get().clearProgress();
        } catch (e) {
            console.error("Failed to cancel backup", e);
        }
    }
}));
