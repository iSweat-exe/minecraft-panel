import React, { useState, useEffect } from 'react';
import { OverviewPanel } from './OverviewPanel';
import { OptionsPanel } from './OptionsPanel';
import { PlayersPanel } from './PlayersPanel';
import { ConsolePanel } from './ConsolePanel';
import { SftpPanel } from './SftpPanel';
import { WorldsPanel } from './WorldsPanel';
import { BackupsPanel } from './BackupsPanel';
import { ModsPanel } from './ModsPanel';
import { AccessPanel } from './AccessPanel';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { useBackupStore } from '../store/backupStore';
import { BackupProgressAlert } from './overview/BackupProgressAlert';
import { getCurrentWindow } from '@tauri-apps/api/window';
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
    PanelLeftOpen,
    Blocks
} from 'lucide-react';

const NAV_ITEMS = [
    { id: 'server', label: 'Serveur', icon: Power },
    { id: 'options', label: 'Options', icon: SlidersHorizontal },
    { id: 'console', label: 'Console', icon: SquareTerminal },
    { id: 'history', label: 'Historique', icon: FileText },
    { id: 'players', label: 'Joueurs', icon: Users, extra: ChevronRight },
    { id: 'version', label: 'Version', icon: Settings },
    { id: 'files', label: 'Fichiers', icon: Folder },
    { id: 'mods', label: 'Mods', icon: Blocks },
    { id: 'worlds', label: 'Mondes', icon: Globe },
    { id: 'backups', label: 'Sauvegardes', icon: History, extra: TriangleAlert, extraColor: 'text-warning' },
    { id: 'access', label: 'Accès', icon: UserCog },
];

export const Dashboard: React.FC = () => {
    const { setSshStatus, setServiceStatus, setMcPing, serviceStatus, pendingAction } = useConnectionStore();
    const [activeTab, setActiveTab] = useState<string>('server');
    const [sftpInitialPath, setSftpInitialPath] = useState<string>('/');
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        // Update 'now' every minute to refresh the backup alert dynamically
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

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

    useEffect(() => {
        let unlistenDown: () => void;
        let unlistenUp: () => void;

        const handleProgress = (p: { filename: string; written: number; total: number }) => {
            useBackupStore.getState().handleProgressUpdate(p);
        };

        tauriBridge.onDownloadProgress(handleProgress).then(un => unlistenDown = un);
        tauriBridge.onUploadProgress(handleProgress).then(un => unlistenUp = un);

        // Cleanup session on window close
        const unlistenClose = getCurrentWindow().onCloseRequested(async () => {
            const sessionUuid = localStorage.getItem('panel_session_uuid');
            if (sessionUuid) {
                // We use a fire-and-forget SSH command to delete the file before the window dies
                tauriBridge.sshExecute(`rm -f /minecraft/.panel_sessions/${sessionUuid}.json`).catch(() => {});
            }
        });

        return () => {
            if (unlistenDown) unlistenDown();
            if (unlistenUp) unlistenUp();
            unlistenClose.then(f => f());
        };
    }, []);

    const disconnect = async () => {
        try {
            const sessionUuid = localStorage.getItem('panel_session_uuid');
            if (sessionUuid) {
                await tauriBridge.sshExecute(`rm -f /minecraft/.panel_sessions/${sessionUuid}.json`);
            }
            await tauriBridge.sshDisconnect();
        } catch (e) {
            console.error(e);
        }
        localStorage.removeItem('ssh_auto_connect');
        setSshStatus('disconnected');
    };

    const [collapsed, setCollapsed] = useState(false);
    const lastBackupTime = useBackupStore(state => state.lastBackupTime);

    const getServerIconColor = () => {
        if (pendingAction) return "text-warning";
        if (serviceStatus?.active_state === 'active') return "text-success";
        if (serviceStatus?.active_state === 'failed') return "text-danger";
        return activeTab === 'server' ? "text-primary" : "text-muted-foreground";
    };

    const getServerBorderColor = () => {
        if (pendingAction) return "border-warning";
        if (serviceStatus?.active_state === 'active') return "border-success";
        if (serviceStatus?.active_state === 'failed') return "border-danger";
        return "border-primary";
    };

    return (
        <div className="flex h-full bg-background text-foreground">
            {/* Sidebar */}
            <aside className={`${collapsed ? 'w-[60px]' : 'w-[260px]'} bg-surface border-r border-border flex flex-col shrink-0 transition-[width] duration-200`}>
                {/* Header */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={`h-14 text-muted-foreground hover:text-foreground border-b border-border flex items-center transition-colors overflow-hidden whitespace-nowrap shrink-0 ${
                        collapsed ? 'justify-center px-0' : 'justify-between px-5'
                    }`}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {!collapsed && <span className="text-[15px] font-bold text-foreground tracking-wide">Uwu Server</span>}
                    {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>

                <nav className="flex-1 py-4 overflow-y-auto custom-scrollbar">
                    {NAV_ITEMS.map(({ id, label, icon: Icon, extra: Extra, extraColor }) => {
                        let showExtra = !!Extra;
                        if (id === 'backups') {
                            showExtra = !lastBackupTime || (now - lastBackupTime > 3600000);
                        }
                        return (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`w-full flex items-center py-3 text-[15px] font-medium transition-colors border-r-2 ${
                                collapsed ? 'justify-center px-0' : 'justify-between px-5'
                            } ${
                                activeTab === id
                                    ? `text-primary-foreground bg-surface-hover ${id === 'server' ? getServerBorderColor() : 'border-primary'}`
                                    : id === 'server'
                                        ? `text-foreground bg-surface/40 hover:bg-surface-hover ${getServerBorderColor()}`
                                        : 'text-muted-foreground hover:text-foreground hover:bg-surface-hover border-transparent'
                            }`}
                            title={collapsed ? label : undefined}
                        >
                            <div className="flex items-center gap-3">
                                <Icon 
                                    size={20} 
                                    strokeWidth={2} 
                                    className={id === 'server' ? getServerIconColor() : (activeTab === id ? "text-primary" : "text-muted-foreground")} 
                                />
                                {!collapsed && label}
                            </div>
                            {!collapsed && showExtra && Extra && (
                                <Extra size={16} strokeWidth={2} className={extraColor || "text-muted-foreground"} />
                            )}
                        </button>
                    )})}
                </nav>

                <div className={`p-4 ${collapsed ? 'hidden' : 'block'}`}>
                    <BackupProgressAlert />
                </div>
                    
                    <button
                        onClick={disconnect}
                        className={`w-full flex items-center gap-3 py-4 text-[15px] font-medium text-muted-foreground hover:text-danger hover:bg-surface-hover transition-colors ${
                            collapsed ? 'justify-center px-0' : 'px-5'
                        }`}
                        title={collapsed ? 'Déconnexion' : undefined}
                    >
                        <LogOut size={18} />
                        {!collapsed && 'Déconnexion'}
                    </button>
            </aside>

            {/* Main */}
            <main className={`flex-1 overflow-hidden ${activeTab === 'console' ? '' : 'p-4'}`}>
                {activeTab === 'server' && (
                    <div className="flex flex-col gap-4 h-full">
                        <OverviewPanel onManageFiles={() => setActiveTab('files')} />
                    </div>
                )}

                {activeTab === 'console' && (
                    <div className="h-full">
                        <ConsolePanel />
                    </div>
                )}

                {activeTab === 'options' && (
                    <OptionsPanel />
                )}

                {activeTab === 'players' && (
                    <PlayersPanel />
                )}

                {activeTab === 'files' && (
                    <SftpPanel initialPath={sftpInitialPath} />
                )}

                {activeTab === 'mods' && (
                    <ModsPanel onOpenFiles={(path) => {
                        setSftpInitialPath(path);
                        setActiveTab('files');
                    }} />
                )}

                {activeTab === 'worlds' && (
                    <WorldsPanel />
                )}

                {activeTab === 'backups' && (
                    <BackupsPanel />
                )}

                {activeTab === 'access' && (
                    <AccessPanel />
                )}

                {['history', 'version'].includes(activeTab) && (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        Section "{NAV_ITEMS.find(i => i.id === activeTab)?.label}" — En cours de développement
                    </div>
                )}
            </main>
        </div>
    );
};
