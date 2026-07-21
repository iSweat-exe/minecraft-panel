import { useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';

import { useSessionStore } from '../store/sessionStore';
import type { PanelSession } from '../store/sessionStore';

export type { PanelSession };

let cachedUserInfo: any = null;
async function getUserInfo() {
    if (cachedUserInfo) return cachedUserInfo;
    try {
        const stored = localStorage.getItem('panel_user_info');
        if (stored) {
            cachedUserInfo = JSON.parse(stored);
            return cachedUserInfo;
        }
        const res = await fetch('https://ipwho.is/');
        const data = await res.json();
        
        // Fetch explicit v4 and v6
        const [v4Req, v6Req] = await Promise.allSettled([
            fetch('https://ipv4.icanhazip.com').then(r => r.text()),
            fetch('https://ipv6.icanhazip.com').then(r => r.text())
        ]);
        
        const ipv4 = v4Req.status === 'fulfilled' && v4Req.value ? v4Req.value.trim() : null;
        const ipv6 = v6Req.status === 'fulfilled' && v6Req.value ? v6Req.value.trim() : null;

        if (data) {
            const info = {
                ip: ipv4 || data.ip || 'Inconnu',
                ipv6: ipv6 || undefined,
                location: data.city && data.country ? `${data.city}, ${data.country}` : 'Inconnu',
                os: navigator.userAgent.includes('Win') ? 'Windows' : 
                    navigator.userAgent.includes('Mac') ? 'MacOS' : 
                    navigator.userAgent.includes('Linux') ? 'Linux' : 'Autre'
            };
            localStorage.setItem('panel_user_info', JSON.stringify(info));
            cachedUserInfo = info;
            return info;
        }
    } catch (e) {
        console.error("Failed to fetch user info", e);
    }
    
    cachedUserInfo = { ip: 'Inconnu', location: 'Inconnu', os: 'Inconnu' };
    return cachedUserInfo;
}

export function useSessionPing() {
    const { sshStatus } = useConnectionStore();
    const setSessions = useSessionStore(state => state.setSessions);

    useEffect(() => {
        if (sshStatus !== 'connected') return;

        const sessionUuid = localStorage.getItem('panel_session_uuid');
        let displayName = localStorage.getItem('panel_display_name') || 'Anonyme';
        let avatarData = localStorage.getItem('panel_avatar_base64') || '';
        
        // Clean up old bugged localstorage value
        localStorage.removeItem('panel_connected_at');
        
        // Ensure connectedAt is set once per session launch
        let connectedAt = parseInt(sessionStorage.getItem('panel_connected_at') || '0', 10);
        if (!connectedAt) {
            connectedAt = Date.now();
            sessionStorage.setItem('panel_connected_at', connectedAt.toString());
        }

        const pingAndFetch = async () => {
            if (!sessionUuid) return;
            displayName = localStorage.getItem('panel_display_name') || 'Anonyme';
            avatarData = localStorage.getItem('panel_avatar_base64') || '';
            
            // Protect against huge base64 strings crashing the SSH channel
            if (avatarData.length > 100000) {
                avatarData = '';
                localStorage.removeItem('panel_avatar_base64');
            }
            
            const userInfo = await getUserInfo();

            const payload = JSON.stringify({
                uuid: sessionUuid,
                name: displayName,
                avatar: avatarData,
                connectedAt,
                lastSeen: Date.now(),
                ip: userInfo.ip,
                ipv6: userInfo.ipv6,
                location: userInfo.location,
                os: userInfo.os
            });

            const safePayload = payload.replace(/'/g, "'\\''");
            const safeUuid = sessionUuid.replace(/'/g, "'\\''");

            // Heartbeat + Fetch + Cleanup (delete files older than 2 minutes to be safe)
            const script = `
                mkdir -p /minecraft/.panel_sessions
                echo '${safePayload}' > /minecraft/.panel_sessions/${safeUuid}.json
                find /minecraft/.panel_sessions -type f -mtime +30 -delete
                cat /minecraft/.panel_sessions/*.json 2>/dev/null || echo ""
            `;

            try {
                const output = await tauriBridge.sshExecute(script);
                const lines = output.split('\n').filter(l => l.trim().startsWith('{'));
                
                const activeSessions: PanelSession[] = [];
                for (const line of lines) {
                    try {
                        activeSessions.push(JSON.parse(line));
                    } catch (e) {
                        // ignore malformed JSON
                    }
                }
                
                // Sort by connected time
                activeSessions.sort((a, b) => a.connectedAt - b.connectedAt);
                setSessions(activeSessions);

            } catch (err) {
                console.error("Failed to ping session:", err);
            }
        };

        // Run immediately
        pingAndFetch();

        // Then every 10 seconds
        const interval = setInterval(pingAndFetch, 10000);

        return () => clearInterval(interval);
    }, [sshStatus]);

}
