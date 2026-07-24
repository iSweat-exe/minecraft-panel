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

export interface HostExecResponse {
    stdout: string;
    stderr: string;
    exit_code: number | null;
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

export interface SystemHostResponse {
    os_name: string;
    os_version: string;
    kernel_version: string;
    cpu_model: string;
    cpu_cores: number;
    cpu_freq_mhz: number;
    disk_total_mb: number;
    disk_free_mb: number;
}

export interface SystemHealthResponse {
    docker_responsive: boolean;
    disk_space_warning: boolean;
}

export interface ServerLogsResponse {
    lines: string[];
}

export interface MinecraftPingResponse {
    online_players: number;
    max_players: number;
    motd: string;
    version: string;
    sample?: { id: string; name: string }[];
}

export interface ServerCrashesResponse {
    crash_reports: string[];
}

export const tauriBridge = {
    getPlayersList: (nodeUrl: string, nodeToken: string, serverPath: string) => invoke<unknown[]>('get_players_list', { nodeUrl, nodeToken, serverPath }),
    
    // Sub-users & Permissions
    getPanelUsers: (nodeUrl: string, nodeToken: string) => invoke<import('../types/permissions').PanelUser[]>('get_panel_users', { nodeUrl, nodeToken }),
    savePanelUser: (nodeUrl: string, nodeToken: string, user: import('../types/permissions').PanelUser) => invoke<import('../types/permissions').PanelUser[]>('save_panel_user', { nodeUrl, nodeToken, user }),
    deletePanelUser: (nodeUrl: string, nodeToken: string, username: string) => invoke<import('../types/permissions').PanelUser[]>('delete_panel_user', { nodeUrl, nodeToken, username }),
    verifyPanelUser: (nodeUrl: string, nodeToken: string, username: string, password: string) => invoke<import('../types/permissions').PanelUser>('verify_panel_user', { nodeUrl, nodeToken, username, password }),

    // Docker Management
    nodeDockerListContainers: (nodeUrl: string, nodeToken: string) => invoke<DockerContainerInfo[]>('node_docker_list_containers', { nodeUrl, nodeToken }),
    nodeDockerContainerAction: (nodeUrl: string, nodeToken: string, containerId: string, action: 'start' | 'stop' | 'restart' | 'remove') =>
        invoke<void>('node_docker_container_action', { nodeUrl, nodeToken, containerId, action }),
    nodeDockerSystemPrune: (nodeUrl: string, nodeToken: string) => invoke<string>('node_docker_system_prune', { nodeUrl, nodeToken }),
    nodeDockerContainerLogs: (nodeUrl: string, nodeToken: string, containerName: string, tail?: number) =>
        invoke<string>('node_docker_container_logs', { nodeUrl, nodeToken, containerName, tail }),
    nodeDockerListImages: (nodeUrl: string, nodeToken: string) => invoke<DockerImageInfo[]>('node_docker_list_images', { nodeUrl, nodeToken }),
    nodeDockerPullImage: (nodeUrl: string, nodeToken: string, imageName: string) => invoke<string>('node_docker_pull_image', { nodeUrl, nodeToken, imageName }),
    nodeDockerRemoveImage: (nodeUrl: string, nodeToken: string, imageId: string) => invoke<string>('node_docker_remove_image', { nodeUrl, nodeToken, imageId }),
    nodeDockerRunContainer: (nodeUrl: string, nodeToken: string, options: {
        image: string;
        name?: string;
        ports?: string;
        envVars?: string[];
        restartPolicy?: string;
    }) => invoke<string>('node_docker_run_container', { nodeUrl, nodeToken, ...options, envVars: options.envVars }),
    nodeDockerInspectContainer: (nodeUrl: string, nodeToken: string, containerId: string) => invoke<string>('node_docker_inspect_container', { nodeUrl, nodeToken, containerId }),
    nodeDockerUpdateContainer: (nodeUrl: string, nodeToken: string, options: {
        containerId: string;
        newName?: string;
        restartPolicy?: string;
        memory?: string;
        memorySwap?: string;
    }) => invoke<void>('node_docker_update_container', { nodeUrl, nodeToken, ...options }),
    nodeDockerRecreateContainer: (nodeUrl: string, nodeToken: string, options: {
        containerId: string;
        image: string;
        name: string;
        ports?: string;
        envVars?: string[];
        restartPolicy?: string;
    }) => invoke<string>('node_docker_recreate_container', { nodeUrl, nodeToken, ...options, envVars: options.envVars }),


    
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
    nodeRconExecuteMulti: (nodeUrl: string, nodeToken: string, serverId: string, commands: string[]) => invoke<string[]>('node_rcon_execute_multi', { nodeUrl, nodeToken, serverId, commands }),
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
    nodeGetSystemHost: (nodeUrl: string, nodeToken: string) => invoke<SystemHostResponse>('node_get_system_host', { nodeUrl, nodeToken }),
    nodeGetSystemHealth: (nodeUrl: string, nodeToken: string) => invoke<SystemHealthResponse>('node_get_system_health', { nodeUrl, nodeToken }),
    nodeGetSystemLogs: (nodeUrl: string, nodeToken: string, lines?: number) => invoke<ServerLogsResponse>('node_get_system_logs', { nodeUrl, nodeToken, lines }),
    nodeGetServerPing: (nodeUrl: string, nodeToken: string, serverId: string) => invoke<MinecraftPingResponse>('node_get_server_ping', { nodeUrl, nodeToken, serverId }),
    nodeGetServerCrashes: (nodeUrl: string, nodeToken: string, serverId: string) => invoke<ServerCrashesResponse>('node_get_server_crashes', { nodeUrl, nodeToken, serverId }),
    nodeGetServerLogs: (nodeUrl: string, nodeToken: string, serverId: string, lines?: number) => invoke<ServerLogsResponse>('node_get_server_logs', { nodeUrl, nodeToken, serverId, lines }),
    nodeApiRequest: (nodeUrl: string, nodeToken: string, method: string, path: string, body?: any) => invoke<any>('node_api_request', { nodeUrl, nodeToken, method, path, body }),
};
