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
        const user = localStorage.getItem('panel_display_name') || 'Anonyme';
        const userId = localStorage.getItem('panel_session_uuid') || 'unknown';
        
        const logEntry: ActionLog = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            user,
            userId,
            action,
            details
        };
        
        const logLine = JSON.stringify(logEntry) + "\n";
        
        // Base64 encode to safely transmit JSON via bash command without escaping issues
        // Using Buffer in browser might not work, so we use btoa
        const b64 = btoa(unescape(encodeURIComponent(logLine)));
        
        const script = `
            mkdir -p /minecraft/.panel_logs
            echo "${b64}" | base64 -d >> /minecraft/.panel_logs/history.jsonl
        `;
        
        await tauriBridge.sshExecute(script);
    } catch (e) {
        console.error('Failed to log action:', e);
    }
}
