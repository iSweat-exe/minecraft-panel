import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useConnectionStore } from '../store/connectionStore';
import { useBackupStore } from '../store/backupStore';
import { useSessionPing } from '../hooks/useSessions';
import { useMetricsAgent } from '../hooks/useMetricsAgent';
import { BackupProgressAlert } from './overview/BackupProgressAlert';
import { tauriBridge } from '../lib/tauriBridge';
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
    Blocks,
    Clock
} from 'lucide-react';

const NAV_ITEMS = [
    { id: 'server', path: '/', label: 'Serveur', icon: Power },
    { id: 'options', path: '/options', label: 'Options', icon: SlidersHorizontal },
    { id: 'console', path: '/console', label: 'Console', icon: SquareTerminal },
    { id: 'history', path: '/history', label: 'Historique', icon: FileText },
    { id: 'players', path: '/players', label: 'Joueurs', icon: Users, extra: ChevronRight },
    { id: 'version', path: '/version', label: 'Version', icon: Settings },
    { id: 'files', path: '/files', label: 'Fichiers', icon: Folder },
    { id: 'mods', path: '/mods', label: 'Mods', icon: Blocks },
    { id: 'worlds', path: '/worlds', label: 'Mondes', icon: Globe },
    { id: 'backups', path: '/backups', label: 'Sauvegardes', icon: History, extra: TriangleAlert, extraColor: 'text-warning' },
    { id: 'access', path: '/access', label: 'Accès', icon: UserCog },
    { id: 'automations', path: '/automations', label: 'Automatisations', icon: Clock },
];

const BackupNavItemExtra: React.FC<{ icon: any, color?: string }> = ({ icon: Icon, color }) => {
    const [now, setNow] = useState(Date.now());
    const lastBackupTime = useBackupStore(state => state.lastBackupTime);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    const showExtra = !lastBackupTime || (now - lastBackupTime > 3600000);

    if (!showExtra) return null;
    return <Icon size={16} strokeWidth={2} className={color || "text-muted-foreground"} />;
};

export const AppLayout: React.FC = () => {
    const { setSshStatus, setServiceStatus, setMcPing, serviceStatus, pendingAction } = useConnectionStore();
    const [collapsed, setCollapsed] = useState(false);
    const location = useLocation();
    useSessionPing();
    useMetricsAgent();

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
        let isMounted = true;
        let unlistenDown: (() => void) | undefined;
        let unlistenUp: (() => void) | undefined;
        let unlistenClose: (() => void) | undefined;

        const handleProgress = (p: { filename: string; written: number; total: number }) => {
            useBackupStore.getState().handleProgressUpdate(p);
        };

        tauriBridge.onDownloadProgress(handleProgress).then(un => {
            if (isMounted) unlistenDown = un;
            else un();
        });
        
        tauriBridge.onUploadProgress(handleProgress).then(un => {
            if (isMounted) unlistenUp = un;
            else un();
        });

        getCurrentWindow().onCloseRequested(async () => {
            const sessionUuid = localStorage.getItem('panel_session_uuid');
            if (sessionUuid) {
                tauriBridge.sshExecute(`rm -f /minecraft/.panel_sessions/${sessionUuid}.json`).catch(() => {});
            }
        }).then(un => {
            if (isMounted) unlistenClose = un;
            else un();
        });

        return () => {
            isMounted = false;
            if (unlistenDown) unlistenDown();
            if (unlistenUp) unlistenUp();
            if (unlistenClose) unlistenClose();
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

    const getServerIconColor = () => {
        if (pendingAction) return "text-warning";
        if (serviceStatus?.active_state === 'active') return "text-success";
        if (serviceStatus?.active_state === 'failed') return "text-danger";
        return location.pathname === '/' ? "text-primary" : "text-muted-foreground";
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
                    {NAV_ITEMS.map(({ id, path, label, icon: Icon, extra: Extra, extraColor }) => {
                        const isActive = location.pathname === path;
                        return (
                        <NavLink
                            key={id}
                            to={path}
                            className={`w-full flex items-center py-3 text-[15px] font-medium transition-colors border-r-2 ${
                                collapsed ? 'justify-center px-0' : 'justify-between px-5'
                            } ${
                                isActive
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
                                    className={id === 'server' ? getServerIconColor() : (isActive ? "text-primary" : "text-muted-foreground")} 
                                />
                                {!collapsed && label}
                            </div>
                            {!collapsed && Extra && (
                                id === 'backups' ? (
                                    <BackupNavItemExtra icon={Extra} color={extraColor} />
                                ) : (
                                    <Extra size={16} strokeWidth={2} className={extraColor || "text-muted-foreground"} />
                                )
                            )}
                        </NavLink>
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
            <main className={`flex-1 overflow-hidden ${location.pathname === '/console' ? '' : 'p-4'}`}>
                <Outlet />
            </main>
        </div>
    );
};
