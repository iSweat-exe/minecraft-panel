import React, { useState, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { open } from '@tauri-apps/plugin-dialog';

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

    if (verifyingKey) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-200">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full mx-4">
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Host Key Verification</h2>
                    <p className="text-sm text-zinc-400 mb-3">The server presented this fingerprint:</p>
                    <div className="bg-[#0d0d0d] border border-zinc-800 rounded-md p-3 font-mono text-xs text-zinc-300 break-all mb-4">
                        {verifyingKey}
                    </div>
                    <p className="text-xs text-amber-500 mb-5">
                        If you don't recognize this fingerprint, the connection may not be secure.
                    </p>
                    <button 
                        className="w-full text-sm font-medium py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
                        onClick={() => {
                            setVerifyingKey(null);
                            setSshStatus('disconnected');
                        }}
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        );
    }

    if (sshStatus === 'connected') {
        return <>{children}</>;
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-80 mx-4">
                <h1 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6">SSH Connection</h1>
                
                <div className="space-y-4">
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="block text-xs text-zinc-500 mb-1">Host</label>
                            <input 
                                className="w-full bg-[#0d0d0d] text-sm text-zinc-200 py-2 px-3 rounded-md border border-zinc-800 focus:border-zinc-600 focus:outline-none transition-colors" 
                                value={host} 
                                onChange={e => setHost(e.target.value)} 
                                placeholder="localhost"
                            />
                        </div>
                        <div className="w-20">
                            <label className="block text-xs text-zinc-500 mb-1">Port</label>
                            <input 
                                type="number" 
                                className="w-full bg-[#0d0d0d] text-sm text-zinc-200 py-2 px-3 rounded-md border border-zinc-800 focus:border-zinc-600 focus:outline-none transition-colors text-center" 
                                value={port} 
                                onChange={e => setPort(parseInt(e.target.value))} 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">Username</label>
                        <input 
                            className="w-full bg-[#0d0d0d] text-sm text-zinc-200 py-2 px-3 rounded-md border border-zinc-800 focus:border-zinc-600 focus:outline-none transition-colors" 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">Private Key</label>
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 bg-[#0d0d0d] text-sm text-zinc-200 py-2 px-3 rounded-md border border-zinc-800 focus:border-zinc-600 focus:outline-none transition-colors font-mono" 
                                value={keyPath} 
                                onChange={e => setKeyPath(e.target.value)} 
                                placeholder="~/.ssh/id_ed25519"
                            />
                            <button 
                                type="button"
                                onClick={pickKeyFile}
                                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-md border border-zinc-700 transition-colors text-xs"
                                title="Browse"
                            >
                                …
                            </button>
                        </div>
                    </div>

                    <button 
                        className="w-full text-sm font-medium py-2.5 rounded-md bg-zinc-200 hover:bg-white text-zinc-900 transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={connect}
                        disabled={sshStatus === 'reconnecting'}
                    >
                        {sshStatus === 'reconnecting' ? 'Connecting…' : 'Connect'}
                    </button>
                </div>
            </div>
        </div>
    );
};
