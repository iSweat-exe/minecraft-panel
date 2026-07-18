import React from 'react';
import { useConnectionGate } from '../hooks/useConnectionGate';

export const ConnectionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
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
    } = useConnectionGate();

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
                        onClick={dismissKeyVerification}
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
                                className="w-full bg-[#0d0d0d] text-sm text-zinc-200 py-2 px-3 rounded-md border border-zinc-800 focus:border-zinc-600 focus:outline-none transition-colors" 
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
                                className="flex-1 bg-[#0d0d0d] text-sm text-zinc-200 py-2 px-3 rounded-md border border-zinc-800 focus:border-zinc-600 focus:outline-none transition-colors" 
                                value={keyPath} 
                                onChange={e => setKeyPath(e.target.value)} 
                                placeholder="~/.ssh/id_ed25519"
                            />
                            <button 
                                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 rounded-md border border-zinc-700 transition-colors text-sm"
                                onClick={pickKeyFile}
                            >
                                Browse
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <button 
                        className={`w-full py-2.5 rounded-md font-medium text-sm transition-colors ${
                            sshStatus === 'reconnecting' 
                                ? 'bg-indigo-500/50 text-indigo-200 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        }`}
                        onClick={connect}
                        disabled={sshStatus === 'reconnecting'}
                    >
                        {sshStatus === 'reconnecting' ? 'Connecting...' : 'Connect'}
                    </button>
                </div>

                <div className="mt-4 text-center">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-zinc-950 text-zinc-500 border border-zinc-800/50">
                        Status: {sshStatus}
                    </span>
                </div>
            </div>
        </div>
    );
};
