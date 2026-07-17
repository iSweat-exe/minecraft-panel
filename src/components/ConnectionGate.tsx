import React, { useState, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, Server, User, Key, ShieldAlert } from 'lucide-react';

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
            <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-zinc-950 text-white selection:bg-indigo-500/30">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative bg-zinc-900/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full border border-zinc-800/50">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-red-500/10 rounded-xl">
                                <ShieldAlert className="w-6 h-6 text-red-500" />
                            </div>
                            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">Host Key Verification</h2>
                        </div>
                        <p className="mb-4 text-zinc-300 leading-relaxed">The server's host key fingerprint is:</p>
                        <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50 mb-6 font-mono text-sm break-all text-indigo-300 shadow-inner">
                            {verifyingKey}
                        </div>
                        <p className="mb-6 text-sm text-amber-500/90 leading-relaxed bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                            Please confirm if this is correct. If you expected a different fingerprint, this could be a security risk.
                        </p>
                        <button 
                            className="bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-xl w-full font-medium transition-all duration-200 hover:shadow-lg hover:shadow-zinc-900/50 active:scale-[0.98] border border-zinc-700"
                            onClick={() => {
                                setVerifyingKey(null);
                                setSshStatus('disconnected');
                            }}
                        >
                            Acknowledge & Disconnect
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (sshStatus === 'connected') {
        return <>{children}</>;
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-zinc-950 text-white selection:bg-indigo-500/30">
            <div className="relative group">
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
                
                {/* Main Card */}
                <div className="relative bg-zinc-900/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-zinc-800/50">
                    <div className="flex justify-center mb-8">
                        <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                            <Server className="w-8 h-8 text-indigo-400" />
                        </div>
                    </div>
                    
                    <h1 className="text-2xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                        Minecraft Panel
                    </h1>
                    
                    <div className="space-y-5">
                        <div className="flex gap-4">
                            <div className="flex-1 space-y-1.5">
                                <label className="text-xs font-medium text-zinc-400 ml-1">Host</label>
                                <div className="relative">
                                    <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                    <input 
                                        className="w-full bg-zinc-950/50 py-2.5 pl-10 pr-4 rounded-xl border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm placeholder:text-zinc-600" 
                                        value={host} 
                                        onChange={e => setHost(e.target.value)} 
                                        placeholder="localhost"
                                    />
                                </div>
                            </div>
                            <div className="w-24 space-y-1.5">
                                <label className="text-xs font-medium text-zinc-400 ml-1">Port</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-zinc-950/50 p-2.5 rounded-xl border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm text-center" 
                                    value={port} 
                                    onChange={e => setPort(parseInt(e.target.value))} 
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-zinc-400 ml-1">Username</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input 
                                    className="w-full bg-zinc-950/50 py-2.5 pl-10 pr-4 rounded-xl border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm" 
                                    value={username} 
                                    onChange={e => setUsername(e.target.value)} 
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-zinc-400 ml-1">Private Key</label>
                            <div className="relative flex items-center">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <Key className="w-4 h-4 text-zinc-500" />
                                </div>
                                <input 
                                    className="w-full bg-zinc-950/50 py-2.5 pl-10 pr-12 rounded-xl border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm font-mono" 
                                    value={keyPath} 
                                    onChange={e => setKeyPath(e.target.value)} 
                                    placeholder="~/.ssh/id_ed25519"
                                />
                                <button 
                                    type="button"
                                    onClick={pickKeyFile}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700/50"
                                    title="Browse for key file"
                                >
                                    <FolderOpen className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <button 
                            className="relative overflow-hidden w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl mt-6 transition-all duration-200 shadow-lg shadow-indigo-500/25 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group"
                            onClick={connect}
                            disabled={sshStatus === 'reconnecting'}
                        >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                            <span className="relative flex items-center justify-center gap-2">
                                {sshStatus === 'reconnecting' ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Connecting...
                                    </>
                                ) : 'Connect to Server'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
