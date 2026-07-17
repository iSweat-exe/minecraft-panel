import React, { useState } from 'react';
import { ServerControls } from './ServerControls';
import { ConsolePanel } from './ConsolePanel';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { Terminal, FolderSync, Settings, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

type Tab = 'dashboard' | 'sftp' | 'config';

const NAV_ITEMS: { id: Tab; label: string; icon: typeof Terminal }[] = [
    { id: 'dashboard', label: 'Console', icon: Terminal },
    { id: 'sftp', label: 'Files', icon: FolderSync },
    { id: 'config', label: 'Config', icon: Settings },
];

export const Dashboard: React.FC = () => {
    const { setSshStatus } = useConnectionStore();
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [collapsed, setCollapsed] = useState(false);

    const disconnect = async () => {
        try {
            await tauriBridge.sshDisconnect();
        } catch (e) {
            console.error(e);
        }
        setSshStatus('disconnected');
    };

    return (
        <div className="flex h-screen bg-zinc-950 text-zinc-200">
            {/* Sidebar */}
            <aside className={`${collapsed ? 'w-12' : 'w-48'} bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0 transition-[width] duration-200`}>
                {/* Collapse toggle */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="px-3 py-3 text-zinc-500 hover:text-zinc-300 border-b border-zinc-800 flex items-center justify-center transition-colors"
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>

                <nav className="flex-1 py-2">
                    {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`w-full flex items-center gap-3 py-2.5 text-sm transition-colors ${
                                collapsed ? 'justify-center px-0' : 'px-4'
                            } ${
                                activeTab === id
                                    ? 'text-white bg-zinc-800 border-r-2 border-indigo-500'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                            }`}
                            title={collapsed ? label : undefined}
                        >
                            <Icon size={16} />
                            {!collapsed && label}
                        </button>
                    ))}
                </nav>

                <div className="border-t border-zinc-800">
                    <button
                        onClick={disconnect}
                        className={`w-full flex items-center gap-2 text-sm text-zinc-500 hover:text-red-400 py-3 hover:bg-zinc-800 transition-colors ${
                            collapsed ? 'justify-center px-0' : 'px-4'
                        }`}
                        title={collapsed ? 'Disconnect' : undefined}
                    >
                        <LogOut size={14} />
                        {!collapsed && 'Disconnect'}
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-hidden p-4">
                {activeTab === 'dashboard' && (
                    <div className="flex gap-4 h-full">
                        <div className="w-64 shrink-0">
                            <ServerControls />
                        </div>
                        <div className="flex-1 min-w-0">
                            <ConsolePanel />
                        </div>
                    </div>
                )}

                {activeTab === 'sftp' && (
                    <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                        File manager — coming soon
                    </div>
                )}

                {activeTab === 'config' && (
                    <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                        Configuration — coming soon
                    </div>
                )}
            </main>
        </div>
    );
};
