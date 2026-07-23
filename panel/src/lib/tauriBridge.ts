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

export interface DockerContainerInfo {
    id: string;
    names: string;
    image: string;
    status: string;
    state: string;
    ports: string;
    created: string;
}

export interface DockerImageInfo {
    id: string;
    repository: string;
    tag: string;
    size: string;
    created: string;
}

export const tauriBridge = {
    sshConnect: (host: string, port: number, username: string, keyPath: string, expectedFingerprint?: string) =>
        invoke<void>('ssh_connect', { host, port, username, keyPath, expectedFingerprint }),
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
    metricsUnsubscribe: () => invoke<void>('metrics_unsubscribe'),

    consoleSubscribe: () => invoke<void>('console_subscribe'),
    consoleUnsubscribe: () => invoke<void>('console_unsubscribe'),
    consoleSendCommand: (cmd: string) => invoke<void>('console_send_command', { cmd }),
    
    // SFTP
    sftpListDir: (path: string) => invoke<FileEntry[]>('sftp_list_dir', { path }),
    sftpReadFile: (path: string) => invoke<string>('sftp_read_file', { path }),
    sftpReadFileBase64: (path: string) => invoke<string>('sftp_read_file_base64', { path }),
    rconExecuteMulti: (cmds: string[], port: number, password: string) => invoke<string[]>('rcon_execute_multi', { cmds, port, password }),
    getPlayersList: () => invoke<unknown[]>('get_players_list'),
    
    // Sub-users & Permissions
    getPanelUsers: () => invoke<import('../types/permissions').PanelUser[]>('get_panel_users'),
    savePanelUser: (user: import('../types/permissions').PanelUser) => invoke<import('../types/permissions').PanelUser[]>('save_panel_user', { user }),
    deletePanelUser: (username: string) => invoke<import('../types/permissions').PanelUser[]>('delete_panel_user', { username }),
    verifyPanelUser: (username: string, password: string) => invoke<import('../types/permissions').PanelUser>('verify_panel_user', { username, password }),

    // Docker Management
    dockerListContainers: () => invoke<DockerContainerInfo[]>('docker_list_containers'),
    dockerContainerAction: (containerId: string, action: 'start' | 'stop' | 'restart' | 'remove') =>
        invoke<void>('docker_container_action', { containerId, action }),
    dockerSystemPrune: () => invoke<string>('docker_system_prune'),
    dockerContainerLogs: (containerName: string, tail?: number) =>
        invoke<string>('docker_container_logs', { containerName, tail }),
    dockerListImages: () => invoke<DockerImageInfo[]>('docker_list_images'),
    dockerPullImage: (imageName: string) => invoke<string>('docker_pull_image', { imageName }),
    dockerRemoveImage: (imageId: string) => invoke<string>('docker_remove_image', { imageId }),
    dockerRunContainer: (options: {
        image: string;
        name?: string;
        ports?: string;
        envVars?: string[];
        restartPolicy?: string;
    }) => invoke<string>('docker_run_container', { ...options, envVars: options.envVars }),
    dockerInspectContainer: (containerId: string) => invoke<string>('docker_inspect_container', { containerId }),
    dockerUpdateContainer: (options: {
        containerId: string;
        newName?: string;
        restartPolicy?: string;
    }) => invoke<void>('docker_update_container', options),
    dockerRecreateContainer: (options: {
        containerId: string;
        image: string;
        name: string;
        ports?: string;
        envVars?: string[];
        restartPolicy?: string;
    }) => invoke<string>('docker_recreate_container', { ...options, envVars: options.envVars }),

    // VPS Interactive Terminal
    terminalStart: (cols: number, rows: number) => invoke<void>('terminal_start', { cols, rows }),
    terminalWrite: (data: number[]) => invoke<void>('terminal_write', { data }),
    terminalResize: (cols: number, rows: number) => invoke<void>('terminal_resize', { cols, rows }),
    onTerminalData: (callback: (data: number[]) => void): Promise<UnlistenFn> =>
        listen<number[]>('terminal-data', (event) => callback(event.payload)),
    onTerminalExit: (callback: () => void): Promise<UnlistenFn> =>
        listen<void>('terminal-exit', () => callback()),

    sftpWriteFile: (path: string, content: string) => invoke<void>('sftp_write_file', { path, content }),
    sftpDelete: (path: string, is_dir: boolean) => invoke<void>('sftp_delete', { path, isDir: is_dir }),
    sftpRename: (old_path: string, new_path: string) => invoke<void>('sftp_rename', { oldPath: old_path, newPath: new_path }),
    sftpMkdir: (path: string) => invoke<void>('sftp_mkdir', { path }),
    sshCopy: (src: string, dest: string) => invoke<void>('ssh_copy', { src, dest }),
    sshDownloadRemote: (url: string, dest: string) => invoke<void>('ssh_download_remote', { url, dest }),
    sftpDownloadFile: (remotePath: string, localPath: string) => invoke<void>('sftp_download_file', { remotePath, localPath }),
    cancelBackup: () => invoke<void>('cancel_backup'),
    sftpUploadFile: (localPath: string, remotePath: string) => invoke<void>('sftp_upload_file', { localPath, remotePath }),
    
    onConsoleLine: (callback: (line: string) => void): Promise<UnlistenFn> =>
        listen<string>('console-line', (event) => callback(event.payload)),
        
    onConsoleLines: (callback: (lines: string[]) => void): Promise<UnlistenFn> =>
        listen<string[]>('console-lines', (event) => callback(event.payload)),
    
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
                const payload = event.payload as { type: string; paths: string[] };
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
