import React from 'react';
import { ServerControls } from './ServerControls';
import { ConsolePanel } from './ConsolePanel';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';

export const Dashboard: React.FC = () => {
    const { setSshStatus } = useConnectionStore();

    const disconnect = async () => {
        try {
            await tauriBridge.sshDisconnect();
        } catch (e) {
            console.error(e);
        }
        setSshStatus('disconnected');
    };

    return (
        <div className="min-h-screen bg-zinc-950 p-6 text-zinc-200">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-white">Minecraft Manager</h1>
                    <button 
                        onClick={disconnect}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-4 rounded border border-zinc-700 transition-colors"
                    >
                        Disconnect
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                        <ServerControls />
                    </div>
                    <div className="md:col-span-2">
                        <ConsolePanel />
                    </div>
                </div>
            </div>
        </div>
    );
};
