import { useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';

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
    const setSessions = useSessionStore(state => state.setSessions);

    const getCredentials = () => {
        const host = localStorage.getItem('node_host');
        const port = localStorage.getItem('node_port') || '8080';
        const token = localStorage.getItem('node_token');
        if (!host || !token) throw new Error("Daemon credentials missing");
        return { nodeUrl: `http://${host}:${port}`, token };
    };

    useEffect(() => {
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
            try {
                const { nodeUrl, token } = getCredentials();
                displayName = localStorage.getItem('panel_display_name') || 'Anonyme';
                avatarData = localStorage.getItem('panel_avatar_base64') || '';
                
                if (avatarData.length > 100000) {
                    avatarData = '';
                    localStorage.removeItem('panel_avatar_base64');
                }
                
                const userInfo = await getUserInfo();

                const payload = {
                    uuid: sessionUuid,
                    name: displayName,
                    avatar: avatarData || null,
                    connected_at: connectedAt,
                    last_seen: Date.now(),
                    ip: userInfo.ip,
                    ipv6: userInfo.ipv6,
                    location: userInfo.location,
                    os: userInfo.os
                };

                // Upsert session
                await tauriBridge.nodeApiRequest(nodeUrl, token, 'POST', '/api/v1/sessions', payload);

                // Fetch active sessions
                const listRes = await tauriBridge.nodeApiRequest(nodeUrl, token, 'GET', '/api/v1/sessions').catch(() => null);
                if (listRes && listRes.success && Array.isArray(listRes.data)) {
                    const activeSessions = listRes.data.map((s: any) => ({
                        uuid: s.uuid,
                        name: s.name,
                        avatar: s.avatar || '',
                        connectedAt: s.connected_at,
                        lastSeen: s.last_seen,
                        ip: s.ip || 'Inconnu',
                        ipv6: s.ipv6 || undefined,
                        location: s.location || 'Inconnu',
                        os: s.os || 'Inconnu'
                    }));
                    activeSessions.sort((a: any, b: any) => a.connectedAt - b.connectedAt);
                    setSessions(activeSessions);
                }

            } catch (err) {
                console.error("Failed to ping session:", err);
            }
        };

        pingAndFetch();
        const interval = setInterval(pingAndFetch, 10000);

        return () => clearInterval(interval);
    }, []);
}

