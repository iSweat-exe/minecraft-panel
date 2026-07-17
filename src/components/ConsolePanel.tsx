import React, { useEffect, useState, useRef } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConsoleStore } from '../store/consoleStore';

export const ConsolePanel: React.FC = () => {
    const { lines, pushLine } = useConsoleStore();
    const [command, setCommand] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const init = async () => {
            try {
                await tauriBridge.consoleSubscribe();
            } catch (e) {
                console.error("Failed to subscribe to console", e);
            }
        };
        init();

        const unlisten = tauriBridge.onConsoleLine((line) => {
            pushLine(line);
        });

        return () => {
            unlisten.then(f => f());
        };
    }, [pushLine]);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [lines.length]);

    const sendCommand = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim()) return;
        try {
            await tauriBridge.consoleSendCommand(command);
            setCommand('');
        } catch (e) {
            console.error("Failed to send command", e);
            alert(`Error: ${e}`);
        }
    };

    return (
        <div className="bg-zinc-900 p-4 rounded shadow border border-zinc-800 flex flex-col h-[600px]">
            <h2 className="text-xl font-bold mb-4 text-white">Live Console</h2>
            <div 
                ref={containerRef}
                className="flex-1 bg-black text-green-400 rounded overflow-y-auto overflow-x-hidden mb-4 border border-zinc-700 p-2 font-mono text-sm"
            >
                {lines.length > 0 ? (
                    lines.map((line, i) => (
                        <div key={i} className="whitespace-pre-wrap">{line}</div>
                    ))
                ) : (
                    <div className="text-zinc-500">Waiting for logs...</div>
                )}
            </div>
            <form onSubmit={sendCommand} className="flex gap-2">
                <input 
                    type="text" 
                    className="flex-1 bg-zinc-800 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 border border-zinc-700 font-mono text-sm" 
                    placeholder="Enter command (e.g. say Hello World)..." 
                    value={command} 
                    onChange={e => setCommand(e.target.value)} 
                />
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold transition-colors">
                    Send
                </button>
            </form>
        </div>
    );
};
