import React, { useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';

export const ServerControls: React.FC = () => {
    const { serviceStatus, setServiceStatus } = useConnectionStore();

    const fetchStatus = async () => {
        try {
            const status = await tauriBridge.serviceStatus();
            setServiceStatus(status);
        } catch (e) {
            console.error("Failed to fetch status:", e);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const doAction = async (action: 'start' | 'stop' | 'restart') => {
        try {
            await tauriBridge.serviceAction(action);
            setTimeout(fetchStatus, 1000);
        } catch (e) {
            console.error(e);
            alert(`Failed to ${action}: ${e}`);
        }
    };

    return (
        <div className="bg-zinc-900 p-4 rounded shadow border border-zinc-800">
            <h2 className="text-xl font-bold mb-4 text-white">Server Controls</h2>
            <div className="mb-6 space-y-2 text-zinc-300">
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                    <span>State</span>
                    <span className={`font-bold ${serviceStatus?.active_state === 'active' ? 'text-green-500' : 'text-red-500'}`}>
                        {serviceStatus?.active_state || 'Unknown'}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span>Sub State</span>
                    <span className="font-bold text-zinc-400">
                        {serviceStatus?.sub_state || 'Unknown'}
                    </span>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <button onClick={() => doAction('start')} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded w-full transition-colors">Start Server</button>
                <button onClick={() => doAction('restart')} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded w-full transition-colors">Restart Server</button>
                <button onClick={() => doAction('stop')} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded w-full transition-colors mt-4">Stop Server</button>
            </div>
        </div>
    );
};
