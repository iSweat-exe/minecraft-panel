import { useState, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { open } from '@tauri-apps/plugin-dialog';
import { logAction } from '../lib/actionLogger';

export function useConnectionGate() {
    const { sshStatus, setSshStatus, setHost: setStoreHost } = useConnectionStore();
    const [host, setHost] = useState(() => localStorage.getItem('ssh_host') || 'localhost');
    const [port, setPort] = useState(() => parseInt(localStorage.getItem('ssh_port') || '22', 10));
    const [username, setUsername] = useState(() => localStorage.getItem('ssh_username') || 'minecraft');
    const [keyPath, setKeyPath] = useState(() => localStorage.getItem('ssh_keyPath') || 'C:/Users/<name>/.ssh/id_ed25519');
    const [expectedFingerprint, setExpectedFingerprint] = useState<string | undefined>(localStorage.getItem('ssh_fingerprint') || undefined);
    const [displayName, setDisplayName] = useState(() => localStorage.getItem('panel_display_name') || '');
    const [avatarBase64, setAvatarBase64] = useState(() => localStorage.getItem('panel_avatar_base64') || '');
    const [sessionUuid] = useState(() => {
        const stored = localStorage.getItem('panel_session_uuid');
        if (stored) return stored;
        const newUuid = crypto.randomUUID();
        localStorage.setItem('panel_session_uuid', newUuid);
        return newUuid;
    });
    
    const [sshUsername, setSshUsername] = useState(() => localStorage.getItem('ssh_username') || 'root');
    const [subUsername, setSubUsername] = useState(() => localStorage.getItem('sub_username') || '');
    const [loginMode, setLoginMode] = useState<'admin' | 'subuser'>(() => (localStorage.getItem('panel_login_mode') as 'admin' | 'subuser') || 'admin');
    const [password, setPassword] = useState('');
    
    const [verifyingKey, setVerifyingKey] = useState<string | null>(null);

    useEffect(() => {
        const autoConnect = localStorage.getItem('ssh_auto_connect') === 'true';
        tauriBridge.sshStatus().then(status => {
            setSshStatus(status);
            if (status === 'disconnected' && autoConnect) {
                connect();
            }
        }).catch(console.error);
        
        const unlistenHostKey = tauriBridge.onHostKeyVerificationNeeded((fingerprint) => {
            setVerifyingKey(fingerprint);
        });
        
        return () => {
            unlistenHostKey.then(f => f());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setSshStatus]);

    const connect = async (overrideFingerprint?: string) => {
        try {
            setSshStatus('reconnecting');
            const targetFingerprint = overrideFingerprint || expectedFingerprint;
            
            const targetSshUser = loginMode === 'admin' ? username : (sshUsername || 'root');
            await tauriBridge.sshConnect(host, port, targetSshUser, keyPath, targetFingerprint);
            
            const activePanelUser = loginMode === 'subuser' ? subUsername : username;

            if (loginMode === 'subuser') {
                try {
                    await tauriBridge.verifyPanelUser(subUsername, password);
                } catch (verifyErr) {
                    await tauriBridge.sshDisconnect();
                    throw new Error("Nom d'utilisateur ou mot de passe incorrect");
                }
            }

            // Save settings for next time
            localStorage.setItem('ssh_host', host);
            localStorage.setItem('ssh_port', port.toString());
            localStorage.setItem('ssh_username', targetSshUser);
            localStorage.setItem('sub_username', subUsername);
            localStorage.setItem('panel_username', activePanelUser);
            localStorage.setItem('ssh_keyPath', keyPath);
            localStorage.setItem('panel_login_mode', loginMode);
            localStorage.setItem('ssh_auto_connect', 'true');
            localStorage.setItem('panel_display_name', displayName);
            localStorage.setItem('panel_avatar_base64', avatarBase64);
            
            setStoreHost(host);
            setSshStatus('connected');
            logAction('Connexion au panel', { mode: loginMode === 'admin' ? 'Administrateur' : 'Sous-utilisateur' });
        } catch (err: any) {
            console.error(err);
            setSshStatus('disconnected');
            localStorage.removeItem('ssh_auto_connect');
            alert(`Connexion échouée : ${err?.message || err}`);
        }
    };

    const pickKeyFile = async () => {
        try {
            const selected = await open({
                multiple: false,
                title: "Select Private Key",
            });
            if (selected && typeof selected === 'string') {
                setKeyPath(selected);
            }
        } catch (e) {
            console.error("Failed to open dialog", e);
        }
    };

    const dismissKeyVerification = () => {
        setVerifyingKey(null);
        setSshStatus('disconnected');
    };

    const acceptFingerprint = () => {
        if (verifyingKey) {
            localStorage.setItem('ssh_fingerprint', verifyingKey);
            setExpectedFingerprint(verifyingKey);
            const keyToAccept = verifyingKey;
            setVerifyingKey(null);
            connect(keyToAccept);
        }
    };

    return {
        sshStatus,
        host,
        setHost,
        port,
        setPort,
        username,
        setUsername,
        sshUsername,
        setSshUsername,
        subUsername,
        setSubUsername,
        keyPath,
        setKeyPath,
        verifyingKey,
        connect,
        pickKeyFile,
        dismissKeyVerification,
        acceptFingerprint,
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
