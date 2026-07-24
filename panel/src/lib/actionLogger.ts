import { tauriBridge } from './tauriBridge';

export interface ActionLog {
    id: string;
    timestamp: number;
    user: string;
    userId: string;
    action: string;
    details?: any;
}

/**
 * Logs an action to the server-side history file securely.
 * This function does not throw errors to prevent interrupting the main flow.
 */
export async function logAction(action: string, details?: any) {
    try {
        const user = localStorage.getItem('panel_username') || localStorage.getItem('panel_display_name') || localStorage.getItem('ssh_username') || 'Anonyme';
        const userId = localStorage.getItem('panel_session_uuid') || 'unknown';
        
        const logEntry = {
            user,
            user_id: userId,
            action,
            details: details ? JSON.stringify(details) : "{}"
        };
        
        const host = localStorage.getItem('node_host');
        const port = localStorage.getItem('node_port') || '8080';
        const token = localStorage.getItem('node_token');
        if (!host || !token) return;
        const nodeUrl = `http://${host}:${port}`;

        await tauriBridge.nodeApiRequest(nodeUrl, token, 'POST', '/api/history', logEntry);
    } catch (e) {
        console.error('Failed to log action:', e);
    }
}
