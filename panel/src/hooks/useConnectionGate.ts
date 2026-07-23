import { useState, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { logAction } from '../lib/actionLogger';

export function useConnectionGate() {
    const { sshStatus, setSshStatus, setHost: setStoreHost } = useConnectionStore();
    const [host, setHost] = useState(() => localStorage.getItem('node_host') || 'localhost');
    const [port, setPort] = useState(() => parseInt(localStorage.getItem('node_port') || '8080', 10));
    
    const [password, setPassword] = useState(''); // This acts as the Node Token
    
    // Subuser fields
    const [subUsername, setSubUsername] = useState(() => localStorage.getItem('sub_username') || '');
    const [loginMode, setLoginMode] = useState<'admin' | 'subuser'>(() => (localStorage.getItem('panel_login_mode') as 'admin' | 'subuser') || 'admin');

    const [displayName, setDisplayName] = useState(() => localStorage.getItem('panel_display_name') || '');
    const [avatarBase64, setAvatarBase64] = useState(() => localStorage.getItem('panel_avatar_base64') || '');
    const [sessionUuid] = useState(() => {
        const stored = localStorage.getItem('panel_session_uuid');
        if (stored) return stored;
        const newUuid = crypto.randomUUID();
        localStorage.setItem('panel_session_uuid', newUuid);
        return newUuid;
    });

    useEffect(() => {
        const autoConnect = localStorage.getItem('node_auto_connect') === 'true';
        if (autoConnect && password) {
            connect();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const connect = async () => {
        try {
            setSshStatus('reconnecting');
            const nodeUrl = `http://${host}:${port}`;
            
            if (loginMode === 'admin') {
                // Verify Daemon Token
                await tauriBridge.nodeGetInfo(nodeUrl, password);
                localStorage.setItem('node_token', password);
            } else {
                // For subusers, we need to read the users file from the daemon using the admin token
                const adminToken = localStorage.getItem('node_token');
                if (!adminToken) {
                    throw new Error("L'administrateur doit se connecter au moins une fois pour configurer le Daemon.");
                }
                
                await tauriBridge.verifyPanelUser(nodeUrl, adminToken, subUsername, password);
            }

            localStorage.setItem('node_host', host);
            localStorage.setItem('node_port', port.toString());
            localStorage.setItem('sub_username', subUsername);
            localStorage.setItem('panel_login_mode', loginMode);
            localStorage.setItem('node_auto_connect', 'true');
            
            setStoreHost(host);
            setSshStatus('connected');
            logAction('Connexion au panel', { mode: loginMode === 'admin' ? 'Administrateur' : 'Sous-utilisateur' });
        } catch (err: any) {
            console.error(err);
            setSshStatus('disconnected');
            localStorage.removeItem('node_auto_connect');
            alert(`Connexion échouée : ${err?.message || err}`);
        }
    };

    const disconnect = () => {
        setSshStatus('disconnected');
        localStorage.removeItem('node_auto_connect');
    };

    return {
        sshStatus,
        host,
        setHost,
        port,
        setPort,
        subUsername,
        setSubUsername,
        connect,
        disconnect,
        displayName,
        setDisplayName,
        avatarBase64,
        setAvatarBase64,
        sessionUuid,
        loginMode,
        setLoginMode,
        password,
        setPassword,
    };
}


