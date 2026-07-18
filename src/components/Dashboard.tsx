import React, { useState, useEffect } from 'react';
import { ServerControls } from './ServerControls';
import { OverviewPanel } from './OverviewPanel';
import { OptionsPanel } from './OptionsPanel';
import { PlayersPanel } from './PlayersPanel';
import { ConsolePanel } from './ConsolePanel';
import { SftpPanel } from './SftpPanel';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { 
    Settings, 
    LogOut, 
    Power, 
    SlidersHorizontal, 
    FileText, 
    Users, 
    Folder, 
    Globe, 
    History, 
    TriangleAlert, 
    UserCog, 
    ChevronRight,
    SquareTerminal,
    PanelLeftClose,
    PanelLeftOpen
} from 'lucide-react';

const NAV_ITEMS = [
    { id: 'server', label: 'Serveur', icon: Power },
    { id: 'options', label: 'Options', icon: SlidersHorizontal },
    { id: 'console', label: 'Console', icon: SquareTerminal },
    { id: 'history', label: 'Historique', icon: FileText },
    { id: 'players', label: 'Joueurs', icon: Users, extra: ChevronRight },
    { id: 'version', label: 'Version', icon: Settings },
    { id: 'files', label: 'Fichiers', icon: Folder },
    { id: 'worlds', label: 'Mondes', icon: Globe },
    { id: 'backups', label: 'Sauvegardes', icon: History, extra: TriangleAlert, extraColor: 'text-orange-500/80' },
    { id: 'access', label: 'Accès', icon: UserCog },
];

export const Dashboard: React.FC = () => {
    const { setSshStatus, setServiceStatus, setMcPing } = useConnectionStore();
    const [activeTab, setActiveTab] = useState<string>('server');

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const [status, ping] = await Promise.all([
                    tauriBridge.serviceStatus(),
                    tauriBridge.mcPing(),
                ]);
                setServiceStatus(status);
                setMcPing(ping);
            } catch (e) {
                console.error("Failed to fetch status:", e);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 15000);
        return () => clearInterval(interval);
    }, [setServiceStatus, setMcPing]);

    const disconnect = async () => {
        try {
            await tauriBridge.sshDisconnect();
        } catch (e) {
            console.error(e);
        }
        setSshStatus('disconnected');
    };

    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="flex h-screen bg-zinc-950 text-zinc-200">
            {/* Sidebar */}
            <aside className={`${collapsed ? 'w-[60px]' : 'w-[260px]'} bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0 transition-[width] duration-200`}>
                {/* Header */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={`h-14 text-zinc-400 hover:text-zinc-200 border-b border-zinc-800 flex items-center transition-colors overflow-hidden whitespace-nowrap shrink-0 ${
                        collapsed ? 'justify-center px-0' : 'justify-between px-5'
                    }`}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {!collapsed && <span className="text-[15px] font-bold text-zinc-100 tracking-wide">Uwu Server</span>}
                    {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>

                <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
                    {NAV_ITEMS.map(({ id, label, icon: Icon, extra: Extra, extraColor }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`w-full flex items-center py-3 text-[15px] font-medium transition-colors ${
                                collapsed ? 'justify-center px-0' : 'justify-between px-5'
                            } ${
                                activeTab === id
                                    ? 'text-white bg-zinc-800/80 border-r-2 border-indigo-500'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                            }`}
                            title={collapsed ? label : undefined}
                        >
                            <div className="flex items-center gap-3">
                                <Icon size={20} strokeWidth={2} className={activeTab === id ? "text-indigo-400" : "text-zinc-500"} />
                                {!collapsed && label}
                            </div>
                            {!collapsed && Extra && (
                                <Extra size={16} strokeWidth={2} className={extraColor || "text-zinc-600"} />
                            )}
                        </button>
                    ))}
                </nav>

                <div className="border-t border-zinc-800 shrink-0">
                    <button
                        onClick={disconnect}
                        className={`w-full flex items-center gap-3 py-4 text-[15px] font-medium text-zinc-500 hover:text-red-400 hover:bg-zinc-800/50 transition-colors ${
                            collapsed ? 'justify-center px-0' : 'px-5'
                        }`}
                        title={collapsed ? 'Déconnexion' : undefined}
                    >
                        <LogOut size={18} />
                        {!collapsed && 'Déconnexion'}
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-hidden p-4">
                {activeTab === 'server' && (
                    <div className="flex flex-col gap-4 h-full">
                        <OverviewPanel />
                    </div>
                )}

                {activeTab === 'console' && (
                    <div className="flex gap-4 h-full">
                        <div className="w-64 shrink-0">
                            <ServerControls />
                        </div>
                        <div className="flex-1 min-w-0">
                            <ConsolePanel />
                        </div>
                    </div>
                )}

                {activeTab === 'options' && (
                    <OptionsPanel />
                )}

                {activeTab === 'players' && (
                    <PlayersPanel />
                )}

                {activeTab === 'files' && (
                    <SftpPanel />
                )}

                {['history', 'version', 'worlds', 'backups', 'access'].includes(activeTab) && (
                    <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                        Section "{NAV_ITEMS.find(i => i.id === activeTab)?.label}" — En cours de développement
                    </div>
                )}
            </main>
        </div>
    );
};
