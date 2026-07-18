import { useState, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { open } from '@tauri-apps/plugin-dialog';

export function useConnectionGate() {
    const { sshStatus, setSshStatus, setHost: setStoreHost } = useConnectionStore();
    const [host, setHost] = useState('localhost');
    const [port, setPort] = useState(22);
    const [username, setUsername] = useState('minecraft');
    const [keyPath, setKeyPath] = useState('~/.ssh/id_ed25519');
    
    const [verifyingKey, setVerifyingKey] = useState<string | null>(null);

    useEffect(() => {
        tauriBridge.sshStatus().then(setSshStatus).catch(console.error);
        
        const unlistenHostKey = tauriBridge.onHostKeyVerificationNeeded((fingerprint) => {
            setVerifyingKey(fingerprint);
        });
        
        return () => {
            unlistenHostKey.then(f => f());
        };
    }, [setSshStatus]);

    const connect = async () => {
        try {
            setSshStatus('reconnecting');
            await tauriBridge.sshConnect(host, port, username, keyPath);
            setStoreHost(host);
            setSshStatus('connected');
        } catch (err) {
            console.error(err);
            setSshStatus('disconnected');
            alert(`Connection failed: ${err}`);
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

    return {
        sshStatus,
        host,
        setHost,
        port,
        setPort,
        username,
        setUsername,
        keyPath,
        setKeyPath,
        verifyingKey,
        connect,
        pickKeyFile,
        dismissKeyVerification
    };
}
