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
    const [expectedFingerprint, setExpectedFingerprint] = useState<string | undefined>(localStorage.getItem('ssh_fingerprint') || undefined);
    
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

    const connect = async (overrideFingerprint?: string) => {
        try {
            setSshStatus('reconnecting');
            const targetFingerprint = overrideFingerprint || expectedFingerprint;
            await tauriBridge.sshConnect(host, port, username, keyPath, targetFingerprint);
            setStoreHost(host);
            setSshStatus('connected');
        } catch (err) {
            console.error(err);
            setSshStatus('disconnected');
            // If the error is just the key rejection, we don't need to alert if verifyingKey will be set
            // But we can just alert anyway, or suppress if it's a known error.
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
        keyPath,
        setKeyPath,
        verifyingKey,
        connect,
        pickKeyFile,
        dismissKeyVerification,
        acceptFingerprint
    };
}
