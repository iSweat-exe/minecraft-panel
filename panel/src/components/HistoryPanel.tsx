import React, { useState, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { usePermissionStore } from '../store/permissionStore';
import { History, RefreshCw, AlertCircle } from 'lucide-react';
import { ActionLog } from '../lib/actionLogger';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/Table';
import { Button } from './ui/Button';
import { SearchInput } from './ui/SearchInput';

const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

const renderDetails = (details: any) => {
    if (!details) return <span className="text-muted-foreground">-</span>;
    
    if (typeof details === 'string') {
        return <span className="text-muted-foreground">{details}</span>;
    }
    
    return (
        <div className="flex flex-wrap gap-1.5">
            {Object.entries(details).map(([key, value]) => (
                <div key={key} className="flex items-center text-[12px] border border-border/50 rounded overflow-hidden bg-surface/30">
                    <span className="bg-surface-hover px-1.5 py-0.5 text-muted-foreground font-medium border-r border-border/50 capitalize">
                        {key}
                    </span>
                    <span className="px-1.5 py-0.5 font-mono text-foreground">
                        {String(value)}
                    </span>
                </div>
            ))}
        </div>
    );
};

export const HistoryPanel: React.FC = () => {
    const { sshStatus } = useConnectionStore();
    const { users, fetchUsers } = usePermissionStore();
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);

    const currentUsername = localStorage.getItem('panel_username') || localStorage.getItem('ssh_username') || '';

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const getUserInfo = (logUser: string, logUserId: string) => {
        const match = users.find(u => 
            u.username.toLowerCase() === logUser.toLowerCase() || 
            (u.uuid && u.uuid === logUserId)
        );

        let avatarUrl = match?.avatar_base64 || null;
        let displayName = match?.display_name || null;

        if (logUser.toLowerCase() === currentUsername.toLowerCase()) {
            if (!avatarUrl) avatarUrl = localStorage.getItem('panel_avatar_base64') || null;
            if (!displayName) displayName = localStorage.getItem('panel_display_name') || null;
        }

        return {
            displayName: displayName || logUser,
            username: logUser,
            avatarUrl
        };
    };

    const fetchLogs = async () => {
        if (sshStatus !== 'connected') return;
        setLoading(true);
        setError(null);
        try {
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            if (!host || !token) throw new Error("Daemon credentials missing");
            const nodeUrl = `http://${host}:${port}`;

            const response = await tauriBridge.nodeApiRequest(nodeUrl, token, 'GET', '/api/history').catch(() => null);
            if (!response || !response.success || !Array.isArray(response.data)) {
                setLogs([]);
                return;
            }
            
            const parsedLogs: ActionLog[] = response.data.map((log: any) => {
                let details;
                try {
                    details = log.details ? JSON.parse(log.details) : undefined;
                } catch {
                    details = log.details;
                }
                
                return {
                    id: log.id,
                    timestamp: log.timestamp * 1000,
                    user: log.user,
                    userId: log.user_id,
                    action: log.action,
                    details
                };
            });

            parsedLogs.sort((a, b) => b.timestamp - a.timestamp);
            setLogs(parsedLogs);
        } catch (e: any) {
            console.error('Failed to fetch history:', e);
            setError("Impossible de récupérer l'historique.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        
        const interval = setInterval(() => {
            fetchLogs();
        }, 30000);
        return () => clearInterval(interval);
    }, [sshStatus]);

    const filteredLogs = logs.filter(log => 
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
        log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="flex flex-col h-full bg-background animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                            Historique d'Audit
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Traçabilité complète et indélébile de toutes les actions sur le serveur
                        </p>
                    </div>
                    <Button 
                        onClick={fetchLogs} 
                        disabled={loading}
                        variant="secondary"
                        className="gap-2 font-medium"
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        Actualiser
                    </Button>
                </div>
                
                {/* Search Bar */}
                <SearchInput 
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Rechercher une action, un utilisateur, un fichier..."
                    className="max-w-2xl"
                />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto custom-scrollbar border border-border rounded-xl">
                {error && (
                    <div className="bg-danger/10 border border-danger/20 text-danger p-4 m-4 rounded-lg flex items-center gap-3">
                        <AlertCircle size={20} />
                        <span className="font-medium">{error}</span>
                    </div>
                )}
                
                <Table>
                    <TableHeader className="bg-surface/80 backdrop-blur sticky top-0 z-10">
                        <TableRow>
                            <TableHead>Utilisateur</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Détails</TableHead>
                            <TableHead className="text-right">Date & Heure</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!loading && filteredLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-64 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center">
                                        <History size={48} className="mb-4 opacity-30" />
                                        <p className="text-lg font-medium">{searchQuery ? 'Aucun résultat trouvé.' : 'L\'historique est vide.'}</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLogs.map((log) => {
                                const { displayName, username, avatarUrl } = getUserInfo(log.user, log.userId);
                                return (
                                    <TableRow key={log.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs uppercase overflow-hidden shrink-0">
                                                    {avatarUrl ? (
                                                        <img 
                                                            src={avatarUrl} 
                                                            alt={displayName} 
                                                            className="w-full h-full object-cover" 
                                                        />
                                                    ) : (
                                                        <span>{(displayName || username || 'AD').substring(0, 2)}</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-foreground leading-tight">{displayName}</span>
                                                    {displayName !== username && (
                                                        <span className="text-[10px] text-muted-foreground font-mono">@{username}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                    <TableCell>
                                        {log.action.includes('Connexion') ? (
                                            <span className="inline-flex items-center">
                                                {log.action}
                                            </span>
                                        ) : log.action.includes('Déconnexion') ? (
                                            <span className="inline-flex items-center">
                                                {log.action}
                                            </span>
                                        ) : (
                                            <span className="font-medium text-foreground">{log.action}</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="max-w-[400px] whitespace-normal">
                                            {renderDetails(log.details)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                        {formatTime(log.timestamp)}
                                    </TableCell>
                                </TableRow>
                            );
                        })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};
