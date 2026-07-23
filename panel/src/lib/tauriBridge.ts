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

export interface SystemMetricsResponse {
    cpu_percent: number;
    ram_used_mb: number;
    ram_total_mb: number;
    disk_used_gb: number;
    disk_total_gb: number;
    network_rx_bps: number;
    network_tx_bps: number;
}

export interface DaemonInfoResponse {
    version: string;
    protocol_version: number;
    node_id: string;
    docker_version: string;
    total_servers: number;
    running_servers: number;
    uptime_seconds: number;
}

export interface ServerStatusResponse {
    server_id: string;
    container_id: string | null;
    name: string;
    image: string;
    state: string;
    memory_used_bytes: number;
    memory_limit_bytes: number;
    cpu_percent: number;
}

export interface PowerActionResponse {
    server_id: string;
    action: string;
    success: boolean;
    message: string;
}

export interface ContainerSpec {
    server_id: string;
    name: string;
    owner?: string;
    image: string;
    ports: Array<{ container_port: number; host_port: number; protocol: string }>;
    volumes: Array<{ host_path: string; container_path: string; read_only: boolean }>;
    env: string[];
    resources: { memory_limit_bytes: number | null; cpu_quota: number | null; cpu_period: number | null };
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
    sshConnect: (host: string, port: number, username: string, keyPath?: string, password?: string, expectedFingerprint?: string) =>
        invoke<void>('ssh_connect', { host, port, username, keyPath, password, expectedFingerprint }),

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
    getPlayersList: (nodeUrl: string, nodeToken: string) => invoke<unknown[]>('get_players_list', { nodeUrl, nodeToken }),
    
    // Sub-users & Permissions
    getPanelUsers: (nodeUrl: string, nodeToken: string) => invoke<import('../types/permissions').PanelUser[]>('get_panel_users', { nodeUrl, nodeToken }),
    savePanelUser: (nodeUrl: string, nodeToken: string, user: import('../types/permissions').PanelUser) => invoke<import('../types/permissions').PanelUser[]>('save_panel_user', { nodeUrl, nodeToken, user }),
    deletePanelUser: (nodeUrl: string, nodeToken: string, username: string) => invoke<import('../types/permissions').PanelUser[]>('delete_panel_user', { nodeUrl, nodeToken, username }),
    verifyPanelUser: (nodeUrl: string, nodeToken: string, username: string, password: string) => invoke<import('../types/permissions').PanelUser>('verify_panel_user', { nodeUrl, nodeToken, username, password }),

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
    sftpUploadFile: (localPath: string, remotePath: string) => invoke<void>('sftp_upload_file', { localPath, remotePath }),
    sftpDownloadFile: (remotePath: string, localPath: string) => invoke<void>('sftp_download_file', { remotePath, localPath }),
    
    cancelBackup: () => invoke<void>('cancel_backup'),
    
    onConsoleLine: (callback: (line: string) => void): Promise<UnlistenFn> =>
        listen<string>('console-line', (event) => callback(event.payload)),
        
    onConsoleLines: (callback: (lines: string[]) => void): Promise<UnlistenFn> =>
        listen<string[]>('console-lines', (event) => callback(event.payload)),
    
    onMetricsUpdate: (callback: (metrics: SystemMetricsResponse) => void): Promise<UnlistenFn> =>
        listen<SystemMetricsResponse>('metrics-update', (event) => callback(event.payload)),
    
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

    // Daemon API
    nodeGetInfo: (nodeUrl: string, nodeToken: string) => invoke<DaemonInfoResponse>('node_get_info', { nodeUrl, nodeToken }),
    nodeListServers: (nodeUrl: string, nodeToken: string) => invoke<ServerStatusResponse[]>('node_list_servers', { nodeUrl, nodeToken }),
    nodeCreateServer: (nodeUrl: string, nodeToken: string, spec: ContainerSpec) => invoke<string>('node_create_server', { nodeUrl, nodeToken, spec }),
    nodePowerAction: (nodeUrl: string, nodeToken: string, serverId: string, action: string) => invoke<PowerActionResponse>('node_power_action', { nodeUrl, nodeToken, serverId, action }),
    nodeSendCommand: (nodeUrl: string, nodeToken: string, serverId: string, command: string) => invoke<string>('node_send_command', { nodeUrl, nodeToken, serverId, command }),
    nodeInspectContainer: (nodeUrl: string, nodeToken: string, serverId: string) => invoke<any>('node_inspect_container', { nodeUrl, nodeToken, serverId }),
    nodeDownloadRemote: (nodeUrl: string, nodeToken: string, url: string, dest: string) => invoke<void>('node_download_remote', { nodeUrl, nodeToken, url, dest }),
    nodeDeleteServer: (nodeUrl: string, nodeToken: string, serverId: string) => invoke<string>('node_delete_server', { nodeUrl, nodeToken, serverId }),
    nodeGenerateConsoleToken: (serverId: string, jwtSecret: string) => invoke<string>('node_generate_console_token', { serverId, jwtSecret }),
    nodeGetMetrics: (nodeUrl: string, nodeToken: string) => invoke<SystemMetricsResponse>('node_get_metrics', { nodeUrl, nodeToken }),
    nodeListDir: (nodeUrl: string, nodeToken: string, path: string) => invoke<FileEntry[]>('node_list_dir', { nodeUrl, nodeToken, path }),
    nodeReadFile: (nodeUrl: string, nodeToken: string, path: string) => invoke<string>('node_read_file', { nodeUrl, nodeToken, path }),
    nodeReadFileText: (nodeUrl: string, nodeToken: string, path: string) => invoke<string>('node_read_file_text', { nodeUrl, nodeToken, path }),
    nodeWriteFile: (nodeUrl: string, nodeToken: string, path: string, content: string) => invoke<void>('node_write_file', { nodeUrl, nodeToken, path, content }),
    nodeFileAction: (nodeUrl: string, nodeToken: string, path: string, action: any) => invoke<void>('node_file_action', { nodeUrl, nodeToken, path, action }),
    nodeUploadFile: (nodeUrl: string, nodeToken: string, localPath: string, remotePath: string) => invoke<void>('node_upload_file', { nodeUrl, nodeToken, localPath, remotePath }),
    nodeDownloadFile: (nodeUrl: string, nodeToken: string, remotePath: string, localPath: string) => invoke<void>('node_download_file', { nodeUrl, nodeToken, remotePath, localPath }),
};
