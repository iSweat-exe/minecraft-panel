import React, { useState, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';

export const ConnectionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { sshStatus, setSshStatus } = useConnectionStore();
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
            setSshStatus('connected');
        } catch (err) {
            console.error(err);
            setSshStatus('disconnected');
            alert(`Connection failed: ${err}`);
        }
    };

    if (verifyingKey) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-zinc-950 text-white">
                <div className="bg-zinc-900 p-8 rounded shadow-lg max-w-md w-full">
                    <h2 className="text-xl font-bold mb-4">Host Key Verification</h2>
                    <p className="mb-4">The host key fingerprint is:</p>
                    <pre className="bg-zinc-800 p-2 rounded mb-4 break-all text-sm">{verifyingKey}</pre>
                    <p className="mb-4 text-sm text-yellow-500">
                        Please confirm if this is correct. Since we hardcoded the expected fingerprint from the user, this should only happen if it mismatches.
                    </p>
                    <button 
                        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded w-full"
                        onClick={() => {
                            setVerifyingKey(null);
                            setSshStatus('disconnected');
                        }}
                    >
                        Acknowledge
                    </button>
                </div>
            </div>
        );
    }

    if (sshStatus === 'connected') {
        return <>{children}</>;
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-zinc-950 text-white">
            <div className="bg-zinc-900 p-8 rounded shadow-lg max-w-sm w-full">
                <h1 className="text-2xl font-bold mb-6 text-center">Minecraft Panel</h1>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm mb-1">Host</label>
                        <input className="w-full bg-zinc-800 p-2 rounded border border-zinc-700 text-white" value={host} onChange={e => setHost(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Port</label>
                        <input type="number" className="w-full bg-zinc-800 p-2 rounded border border-zinc-700 text-white" value={port} onChange={e => setPort(parseInt(e.target.value))} />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Username</label>
                        <input className="w-full bg-zinc-800 p-2 rounded border border-zinc-700 text-white" value={username} onChange={e => setUsername(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Private Key Path</label>
                        <input className="w-full bg-zinc-800 p-2 rounded border border-zinc-700 text-white" value={keyPath} onChange={e => setKeyPath(e.target.value)} />
                    </div>
                    <button 
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full mt-4"
                        onClick={connect}
                        disabled={sshStatus === 'reconnecting'}
                    >
                        {sshStatus === 'reconnecting' ? 'Connecting...' : 'Connect'}
                    </button>
                </div>
            </div>
        </div>
    );
};
