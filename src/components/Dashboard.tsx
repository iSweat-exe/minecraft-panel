import React, { useState, useEffect } from 'react';
import { OverviewPanel } from './OverviewPanel';
import { OptionsPanel } from './OptionsPanel';
import { PlayersPanel } from './PlayersPanel';
import { ConsolePanel } from './ConsolePanel';
import { SftpPanel } from './SftpPanel';
import { WorldsPanel } from './WorldsPanel';
import { BackupsPanel } from './BackupsPanel';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { useBackupStore } from '../store/backupStore';
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
    Loader2,
    CheckCircle
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
    { id: 'backups', label: 'Sauvegardes', icon: History, extra: TriangleAlert, extraColor: 'text-warning' },
    { id: 'access', label: 'Accès', icon: UserCog },
];

export const Dashboard: React.FC = () => {
    const { setSshStatus, setServiceStatus, setMcPing, serviceStatus, pendingAction } = useConnectionStore();
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

    useEffect(() => {
        let unlistenDown: () => void;
        let unlistenUp: () => void;

        const handleProgress = (p: { filename: string; written: number; total: number }) => {
            useBackupStore.getState().handleProgressUpdate(p);
        };

        tauriBridge.onDownloadProgress(handleProgress).then(un => unlistenDown = un);
        tauriBridge.onUploadProgress(handleProgress).then(un => unlistenUp = un);

        return () => {
            if (unlistenDown) unlistenDown();
            if (unlistenUp) unlistenUp();
        };
    }, []);

    const disconnect = async () => {
        try {
            await tauriBridge.sshDisconnect();
        } catch (e) {
            console.error(e);
        }
        setSshStatus('disconnected');
    };

    const [collapsed, setCollapsed] = useState(false);
    const backupState = useBackupStore();

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
                    {NAV_ITEMS.map(({ id, label, icon: Icon, extra: Extra, extraColor }) => (
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
                            {!collapsed && Extra && (
                                <Extra size={16} strokeWidth={2} className={extraColor || "text-muted-foreground"} />
                            )}
                        </button>
                    ))}
                </nav>

                <div className="border-t border-border shrink-0">
                    {/* Global Backup Progress indicator */}
                    {(backupState.loading || backupState.success) && (
                        <div className={`border-b ${backupState.success ? 'border-success/20 bg-success/5' : 'border-border'} p-4 ${collapsed ? 'hidden' : 'block'} transition-colors duration-500`}>
                            <div className="flex items-center gap-2 mb-2">
                                {backupState.success ? (
                                    <CheckCircle className="text-success shrink-0" size={16} />
                                ) : (
                                    <Loader2 className="animate-spin text-primary shrink-0" size={16} />
                                )}
                                <span className={`text-xs font-medium truncate ${backupState.success ? 'text-success' : 'text-foreground'}`}>
                                    {backupState.statusText || 'Transfert en cours...'}
                                </span>
                            </div>
                            {backupState.progress && backupState.progress.total > 0 && (
                                <div className="space-y-1">
                                    <div className={`h-1.5 rounded-full overflow-hidden ${backupState.success ? 'bg-success/20' : 'bg-surface'}`}>
                                        <div 
                                            className={`h-full transition-all duration-300 ${backupState.success ? 'bg-success' : 'bg-primary'}`}
                                            style={{ width: `${(backupState.progress.written / backupState.progress.total) * 100}%` }}
                                        />
                                    </div>
                                    <div className={`flex justify-between text-[10px] font-medium ${backupState.success ? 'text-success' : 'text-muted-foreground'}`}>
                                        <span>{(backupState.speed / 1024 / 1024).toFixed(1)} MB/s</span>
                                        <span>{Math.round((backupState.progress.written / backupState.progress.total) * 100)}%</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
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
                </div>
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
                    <SftpPanel />
                )}

                {activeTab === 'worlds' && (
                    <WorldsPanel />
                )}

                {activeTab === 'backups' && (
                    <BackupsPanel />
                )}

                {['history', 'version', 'access'].includes(activeTab) && (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        Section "{NAV_ITEMS.find(i => i.id === activeTab)?.label}" — En cours de développement
                    </div>
                )}
            </main>
        </div>
    );
};
