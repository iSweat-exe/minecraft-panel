import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useConnectionStore } from '../store/connectionStore';
import { usePermissionStore } from '../store/permissionStore';
import { useBackupStore } from '../store/backupStore';
import { useSessionPing } from '../hooks/useSessions';
import { useMetricsAgent } from '../hooks/useMetricsAgent';
import { useServerControls } from '../hooks/useServerControls';
import { BackupProgressAlert } from './overview/BackupProgressAlert';
import { tauriBridge } from '../lib/tauriBridge';
import { logAction } from '../lib/actionLogger';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { UserProfileSettingsModal } from './dialogs/UserProfileSettingsModal';
import { useActiveServerStore } from '../store/activeServerStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select';
import { SiDocker } from 'react-icons/si';
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
    Clock,
    Server
} from 'lucide-react';

const NAV_ITEMS = [
    { id: 'server', path: '/', label: 'Serveur', icon: Power },
    { id: 'options', path: '/options', label: 'Options', icon: SlidersHorizontal },
    { id: 'system', path: '/system', label: 'Système', icon: Server },
    { id: 'docker', path: '/docker', label: 'Docker', icon: SiDocker },
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
    const { setSshStatus } = useConnectionStore();
    const { currentUser, fetchUsers } = usePermissionStore();
    const [collapsed, setCollapsed] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const location = useLocation();
    useSessionPing();
    useMetricsAgent();

    // Call useServerControls at the AppLayout level to keep the background polling alive globally
    const { serverState, pendingAction } = useServerControls();

    const { activeServerId, setActiveServerId } = useActiveServerStore();
    const [servers, setServers] = useState<{ id: string; name: string }[]>([]);

    const fetchServers = async () => {
        try {
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            if (!host || !token) return;
            const nodeUrl = `http://${host}:${port}`;
            const list = await tauriBridge.nodeListServers(nodeUrl, token);
            setServers(list.map(s => ({ id: s.server_id, name: s.name })));
        } catch (e) {
            console.error("Failed to list servers:", e);
        }
    };

    useEffect(() => {
        fetchServers();
        // Refresh server list every 30s
        const interval = setInterval(fetchServers, 30000);
        return () => clearInterval(interval);
    }, []);

    const username = currentUser?.username || localStorage.getItem('panel_username') || localStorage.getItem('ssh_username') || 'admin';
    const displayName = currentUser?.display_name || localStorage.getItem('panel_display_name') || '';
    const userAvatar = currentUser?.avatar_base64 || localStorage.getItem('panel_avatar_base64') || '';

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

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
                const host = localStorage.getItem('node_host');
                const port = localStorage.getItem('node_port') || '8080';
                const token = localStorage.getItem('node_token');
                if (host && token) {
                    const nodeUrl = `http://${host}:${port}`;
                    tauriBridge.nodeApiRequest(nodeUrl, token, 'DELETE', `/api/v1/sessions/${sessionUuid}`).catch(() => {});
                }
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
            await logAction('Déconnexion du panel');
            const sessionUuid = localStorage.getItem('panel_session_uuid');
            if (sessionUuid) {
                const host = localStorage.getItem('node_host');
                const port = localStorage.getItem('node_port') || '8080';
                const token = localStorage.getItem('node_token');
                if (host && token) {
                    const nodeUrl = `http://${host}:${port}`;
                    await tauriBridge.nodeApiRequest(nodeUrl, token, 'DELETE', `/api/v1/sessions/${sessionUuid}`).catch(() => {});
                }
            }
        } catch (e) {
            console.error(e);
        }
        localStorage.removeItem('ssh_auto_connect');
        setSshStatus('disconnected');
    };

    const getServerIconColor = () => {
        if (pendingAction) return "text-warning";
        if (serverState === 'running') return "text-success";
        if (serverState === 'exited' || serverState === 'dead' || serverState === 'failed') return "text-danger";
        return location.pathname === '/' ? "text-primary" : "text-muted-foreground";
    };

    const getServerBorderColor = () => {
        if (pendingAction) return "border-warning";
        if (serverState === 'running') return "border-success";
        if (serverState === 'exited' || serverState === 'dead' || serverState === 'failed') return "border-danger";
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

                {/* Server Selector */}
                {!collapsed && (
                    <div className="px-4 py-3 border-b border-border bg-surface-hover/20">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 block tracking-wider px-1">Serveur Actif</label>
                        <Select value={activeServerId} onValueChange={(val) => setActiveServerId(val)}>
                            <SelectTrigger className="w-full bg-background border-border hover:border-primary transition-colors text-xs font-medium">
                                <SelectValue placeholder="Sélectionner un serveur" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default" className="text-xs">
                                    Par défaut (default)
                                </SelectItem>
                                {servers.filter(s => s.id !== 'default').map(s => (
                                    <SelectItem key={s.id} value={s.id} className="text-xs">
                                        {s.name || s.id} 
                                        {/* <span className="text-muted-foreground text-[10px] ml-1">({s.id})</span> */}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

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
                    className={`w-full flex items-center gap-3 py-3 text-[14px] font-medium text-muted-foreground hover:text-danger hover:bg-surface-hover transition-colors ${
                        collapsed ? 'justify-center px-0' : 'px-5'
                    }`}
                    title={collapsed ? 'Déconnexion' : undefined}
                >
                    <LogOut size={18} />
                    {!collapsed && 'Déconnexion'}
                </button>

                {/* User Profile Footer */}
                <div className="border-t border-border p-3 flex items-center justify-between bg-surface-hover/30 shrink-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                        {userAvatar ? (
                            <img src={userAvatar} alt={username} className="w-9 h-9 rounded-full object-cover shrink-0 border border-border/80 shadow-sm" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs shrink-0 uppercase">
                                {(username || 'AD').substring(0, 2)}
                            </div>
                        )}
                        {!collapsed && (
                            <div className="flex flex-col truncate">
                                <span className="text-xs font-bold text-foreground truncate leading-tight">
                                    {displayName || username}
                                </span>
                                <span className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">
                                    @{username}
                                </span>
                            </div>
                        )}
                    </div>
                    {!collapsed && (
                        <button
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors shrink-0"
                            title="Paramètres de l'utilisateur"
                            onClick={() => setIsProfileModalOpen(true)}
                        >
                            <Settings size={16} />
                        </button>
                    )}
                </div>
            </aside>

            {/* Main */}
            <main className={`flex-1 overflow-hidden ${location.pathname === '/console' ? '' : 'p-4'}`}>
                <Outlet />
            </main>

            {/* User Profile Settings Modal */}
            <UserProfileSettingsModal 
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
            />
        </div>
    );
};
