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
}

export interface SystemMetrics {
    cpu_percent: number;
    ram_used_mb: number;
    ram_total_mb: number;
    disk_used_gb: number;
    disk_total_gb: number;
}

export const tauriBridge = {
    sshConnect: (host: string, port: number, username: string, keyPath: string) =>
        invoke<void>('ssh_connect', { host, port, username, keyPath }),
    sshStatus: () => invoke<ConnectionState>('ssh_status'),
    sshDisconnect: () => invoke<void>('ssh_disconnect'),
    
    serviceAction: (action: 'start' | 'stop' | 'restart') =>
        invoke<void>('service_action', { action }),
    serviceStatus: () => invoke<ServiceState>('service_status'),
    
    mcPing: () => invoke<McPing>('mc_ping'),
    systemMetrics: () => invoke<SystemMetrics>('system_metrics'),

    consoleSubscribe: () => invoke<void>('console_subscribe'),
    consoleSendCommand: (cmd: string) => invoke<void>('console_send_command', { cmd }),
    
    onConsoleLine: (callback: (line: string) => void): Promise<UnlistenFn> =>
        listen<string>('console-line', (event) => callback(event.payload)),
    
    onHostKeyVerificationNeeded: (callback: (fingerprint: string) => void): Promise<UnlistenFn> =>
        listen<string>('host-key-verification-needed', (event) => callback(event.payload)),
};
