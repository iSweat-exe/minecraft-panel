import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

export interface ServiceState {
    active_state: string;
    sub_state: string;
}

export interface McPing {
    online: boolean;
    players_online: number | null;
    players_max: number | null;
    latency_ms: number | null;
    sample?: { id: string; name: string }[];
}

export interface SystemMetrics {
    cpu_percent: number;
    ram_used_mb: number;
    ram_total_mb: number;
    disk_used_gb: number;
    disk_total_gb: number;
    network_rx_bps: number;
    network_tx_bps: number;
}

export interface FileEntry {
    name: string;
    is_dir: boolean;
    size: number;
    modified: number;
}

export const tauriBridge = {
    sshConnect: (host: string, port: number, username: string, keyPath: string) =>
        invoke<void>('ssh_connect', { host, port, username, keyPath }),
    sshStatus: () => invoke<ConnectionState>('ssh_status'),
    sshDisconnect: () => invoke<void>('ssh_disconnect'),
    sshExecute: (command: string) => invoke<string>('ssh_execute', { command }),
    
    serviceAction: (action: 'start' | 'stop' | 'restart') =>
        invoke<void>('service_action', { action }),
    serviceStatus: () => invoke<ServiceState>('service_status'),
    
    rconExecute: (cmd: string, port: number, password: string) =>
        invoke<string>('rcon_execute', { cmd, port, password }),

    mcPing: () => invoke<McPing>('mc_ping'),
    metricsSubscribe: () => invoke<void>('metrics_subscribe'),

    consoleSubscribe: () => invoke<void>('console_subscribe'),
    consoleSendCommand: (cmd: string) => invoke<void>('console_send_command', { cmd }),
    
    // SFTP
    sftpListDir: (path: string) => invoke<FileEntry[]>('sftp_list_dir', { path }),
    sftpReadFile: (path: string) => invoke<string>('sftp_read_file', { path }),
    sftpReadFileBase64: (path: string) => invoke<string>('sftp_read_file_base64', { path }),
    rconExecuteMulti: (cmds: string[], port: number, password: string) => invoke<string[]>('rcon_execute_multi', { cmds, port, password }),
    sftpWriteFile: (path: string, content: string) => invoke<void>('sftp_write_file', { path, content }),
    sftpDelete: (path: string, is_dir: boolean) => invoke<void>('sftp_delete', { path, isDir: is_dir }),
    sftpRename: (old_path: string, new_path: string) => invoke<void>('sftp_rename', { oldPath: old_path, newPath: new_path }),
    sftpMkdir: (path: string) => invoke<void>('sftp_mkdir', { path }),
    sshCopy: (src: string, dest: string) => invoke<void>('ssh_copy', { src, dest }),
    sftpDownloadFile: (remotePath: string, localPath: string) => invoke<void>('sftp_download_file', { remotePath, localPath }),
    cancelBackup: () => invoke<void>('cancel_backup'),
    sftpUploadFile: (localPath: string, remotePath: string) => invoke<void>('sftp_upload_file', { localPath, remotePath }),
    
    onConsoleLine: (callback: (line: string) => void): Promise<UnlistenFn> =>
        listen<string>('console-line', (event) => callback(event.payload)),
    
    onMetricsUpdate: (callback: (metrics: SystemMetrics) => void): Promise<UnlistenFn> =>
        listen<SystemMetrics>('metrics-update', (event) => callback(event.payload)),
    
    onHostKeyVerificationNeeded: (callback: (fingerprint: string) => void): Promise<UnlistenFn> =>
        listen<string>('host-key-verification-needed', (event) => callback(event.payload)),

    onFileDrop: (callbacks: {
        onDrop: (paths: string[]) => void;
        onHover?: (hovering: boolean) => void;
    }): Promise<UnlistenFn> => {
        return import('@tauri-apps/api/webview').then(({ getCurrentWebview }) => {
            return getCurrentWebview().onDragDropEvent((event) => {
                const payload = event.payload as any;
                if (payload.type === 'drop') {
                    callbacks.onHover?.(false);
                    callbacks.onDrop(payload.paths);
                } else if (payload.type === 'enter' || payload.type === 'over') {
                    callbacks.onHover?.(true);
                } else if (payload.type === 'leave' || payload.type === 'cancel') {
                    callbacks.onHover?.(false);
                }
            });
        });
    },

    onUploadProgress: (callback: (progress: { filename: string; written: number; total: number }) => void): Promise<UnlistenFn> =>
        listen<{ filename: string; written: number; total: number }>('upload-progress', (event) => callback(event.payload)),

    onDownloadProgress: (callback: (progress: { filename: string; written: number; total: number }) => void): Promise<UnlistenFn> =>
        listen<{ filename: string; written: number; total: number }>('download-progress', (event) => callback(event.payload)),
};
