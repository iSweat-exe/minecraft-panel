import React, { useState, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { History, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { ActionLog } from '../lib/actionLogger';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/Table';
import { useSessionStore } from '../store/sessionStore';

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
    const { sessions } = useSessionStore();
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = async () => {
        if (sshStatus !== 'connected') return;
        setLoading(true);
        setError(null);
        try {
            const exists = await tauriBridge.sshExecute(`test -f /minecraft/.panel_logs/history.jsonl && echo "yes" || echo "no"`);
            if (exists.trim() === 'no') {
                setLogs([]);
                return;
            }

            const content = await tauriBridge.sshExecute(`cat /minecraft/.panel_logs/history.jsonl`);
            
            // Fix concatenated JSON objects caused by missing newline bug
            const fixedContent = content.replace(/\}\{/g, '}\n{');
            const lines = fixedContent.split('\n').filter(l => l.trim() !== '');
            const parsedLogs: ActionLog[] = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    return null;
                }
            }).filter(Boolean);

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
                    <button 
                        onClick={fetchLogs} 
                        disabled={loading}
                        className="bg-surface hover:bg-surface-hover text-foreground px-4 py-2 rounded-lg flex items-center gap-2 border border-border transition-colors disabled:opacity-50 font-medium"
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        Actualiser
                    </button>
                </div>
                
                {/* Search Bar */}
                <div className="relative flex-1 max-w-2xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input 
                        type="text" 
                        placeholder="Rechercher une action, un utilisateur, un fichier..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-surface border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-[15px] shadow-sm"
                    />
                </div>
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
                            filteredLogs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-surface-hover overflow-hidden border border-border/50 shrink-0">
                                                <img 
                                                    src={sessions.find(s => s.uuid === log.userId)?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${log.user}&backgroundColor=1a1a1a&textColor=ffffff`}
                                                    alt={log.user}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <span className="font-semibold text-foreground">{log.user}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-medium text-foreground">{log.action}</span>
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
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};
