import { useState, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';

export interface PanelSession {
    uuid: string;
    name: string;
    connectedAt: number;
    lastSeen: number;
    ip?: string;
    ipv6?: string;
    location?: string;
    os?: string;
    avatar?: string;
}

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

export function useSessions() {
    const { sshStatus } = useConnectionStore();
    const [sessions, setSessions] = useState<PanelSession[]>([]);

    useEffect(() => {
        if (sshStatus !== 'connected') return;

        const sessionUuid = localStorage.getItem('panel_session_uuid');
        let displayName = localStorage.getItem('panel_display_name') || 'Anonyme';
        let avatarData = localStorage.getItem('panel_avatar_base64') || '';
        
        // Ensure connectedAt is set once per session launch
        let connectedAt = parseInt(localStorage.getItem('panel_connected_at') || '0', 10);
        if (!connectedAt) {
            connectedAt = Date.now();
            localStorage.setItem('panel_connected_at', connectedAt.toString());
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

            // Heartbeat + Fetch + Cleanup (delete files older than 2 minutes to be safe)
            const script = `
                mkdir -p /minecraft/.panel_sessions
                echo '${payload}' > /minecraft/.panel_sessions/${sessionUuid}.json
                find /minecraft/.panel_sessions -type f -mmin +2 -delete
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

    return {
        sessions
    };
}
