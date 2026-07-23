import React from 'react';
import { colorizeLogLine } from '../lib/ansiParser';
import { useConsole } from '../hooks/useConsole';
import { usePermissionStore } from '../store/permissionStore';
import { useConnectionStore } from '../store/connectionStore';
import { tauriBridge } from '../lib/tauriBridge';
import { ChevronRight, CornerDownLeft, ArrowDownToLine, Terminal, Bug, FileText, Server } from 'lucide-react';

const LogLine: React.FC<{ line: string }> = React.memo(({ line }) => {
    const spans = colorizeLogLine(line);
    return (
        <div className="leading-5 hover:bg-zinc-800/50 px-3 -mx-3 whitespace-pre-wrap break-all">
            {spans.map((span, i) => (
                <span
                    key={i}
                    style={{
                        color: span.color,
                        fontWeight: span.bold ? 700 : undefined,
                    }}
                >{span.text}</span>
            ))}
        </div>
    );
});

export const ConsolePanel: React.FC = () => {
    const {
        lines,
        command,
        setCommand,
        containerRef,
        inputRef,
        clear,
        sendCommand,
        handleKeyDown,
        handleScroll,
        scrollToBottom,
        isScrolledUp
    } = useConsole();
    const { can } = usePermissionStore();
    const { host } = useConnectionStore();
    const port = localStorage.getItem('node_port') || '8080';
    const token = localStorage.getItem('node_token');
    
    const canSend = can('console.send');
    const [viewMode, setViewMode] = React.useState<'console' | 'crashes' | 'host'>('console');
    const [crashes, setCrashes] = React.useState<string[]>([]);
    const [selectedCrashContent, setSelectedCrashContent] = React.useState<string | null>(null);
    const [isLoadingCrash, setIsLoadingCrash] = React.useState(false);

    // State for Host Terminal
    const [hostLines, setHostLines] = React.useState<{ type: 'input' | 'output' | 'error', text: string }[]>([]);
    const [hostCommand, setHostCommand] = React.useState('');
    const hostInputRef = React.useRef<HTMLInputElement>(null);
    const hostContainerRef = React.useRef<HTMLDivElement>(null);
    const [hostHistory, setHostHistory] = React.useState<string[]>([]);
    const [hostHistoryIndex, setHostHistoryIndex] = React.useState(-1);
    const [isHostExecuting, setIsHostExecuting] = React.useState(false);

    const scrollToBottomHost = () => {
        if (hostContainerRef.current) {
            hostContainerRef.current.scrollTop = hostContainerRef.current.scrollHeight;
        }
    };

    React.useEffect(() => {
        if (viewMode === 'host') scrollToBottomHost();
    }, [hostLines, viewMode]);

    const sendHostCommand = async (e: React.FormEvent) => {
        e.preventDefault();
        const cmd = hostCommand.trim();
        if (!cmd || isHostExecuting) return;

        setHostCommand('');
        setHostHistory(prev => [...prev, cmd]);
        setHostHistoryIndex(-1);
        setIsHostExecuting(true);
        
        setHostLines(prev => [...prev, { type: 'input', text: `$ ${cmd}` }]);

        try {
            if (!host || !port || !token) throw new Error("Daemon credentials missing");
            const nodeUrl = `http://${host}:${port}`;
            
            const res = await fetch(`${nodeUrl}/api/v1/system/host/exec`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ command: cmd })
            });
            
            const data = await res.json();
            if (data.success && data.data) {
                const output = (data.data.stdout + '\n' + data.data.stderr).trim();
                if (output) {
                    setHostLines(prev => [...prev, { type: 'output', text: output }]);
                }
            } else {
                throw new Error(data.error || 'Failed to execute command');
            }
        } catch (error: any) {
            setHostLines(prev => [...prev, { type: 'error', text: String(error) }]);
        } finally {
            setIsHostExecuting(false);
            setTimeout(() => hostInputRef.current?.focus(), 10);
        }
    };

    const handleHostKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (hostHistory.length > 0) {
                const nextIndex = hostHistoryIndex < hostHistory.length - 1 ? hostHistoryIndex + 1 : hostHistoryIndex;
                setHostHistoryIndex(nextIndex);
                setHostCommand(hostHistory[hostHistory.length - 1 - nextIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (hostHistoryIndex > 0) {
                const nextIndex = hostHistoryIndex - 1;
                setHostHistoryIndex(nextIndex);
                setHostCommand(hostHistory[hostHistory.length - 1 - nextIndex]);
            } else if (hostHistoryIndex === 0) {
                setHostHistoryIndex(-1);
                setHostCommand('');
            }
        }
    };

    const loadCrashes = React.useCallback(async () => {
        if (!host || !port || !token) return;
        const nodeUrl = `http://${host}:${port}`;
        try {
            const res = await tauriBridge.nodeGetServerCrashes(nodeUrl, token, 'default');
            setCrashes(res.crash_reports || []);
        } catch (e) {
            console.error("Failed to load crashes", e);
        }
    }, [host, port, token]);

    React.useEffect(() => {
        if (viewMode === 'crashes') {
            loadCrashes();
        }
    }, [viewMode, loadCrashes]);

    const viewCrash = async (filename: string) => {
        if (!host || !port || !token) return;
        const nodeUrl = `http://${host}:${port}`;
        setIsLoadingCrash(true);
        setSelectedCrashContent(null);
        try {
            // Assuming Crash Reports are in /minecraft/crash-reports/{filename}
            const path = `/minecraft/crash-reports/${filename}`;
            const content = await tauriBridge.nodeReadFileText(nodeUrl, token, path);
            setSelectedCrashContent(content);
        } catch (e) {
            console.error("Failed to load crash content", e);
            setSelectedCrashContent("Erreur lors de la lecture du fichier de crash.");
        } finally {
            setIsLoadingCrash(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-surface border border-border">
            <div className={`flex flex-col h-full overflow-hidden bg-surface ${viewMode !== 'console' ? 'hidden' : 'flex'}`}>
                {/* Title bar mimicking a real terminal */}
                <div className="flex items-center gap-2 px-4 py-2 bg-surface-hover border-b border-border select-none shrink-0 justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1.5 mr-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                        </div>
                        <div className="flex bg-black/20 rounded-lg p-0.5 border border-border/50">
                            <button onClick={() => setViewMode('console')} className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'console' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}>
                                <Terminal size={14} /> Console
                            </button>
                            <button onClick={() => setViewMode('host')} className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'host' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}>
                                <Server size={14} /> Terminal Hôte
                            </button>
                            <button onClick={() => setViewMode('crashes')} className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'crashes' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}>
                                <Bug size={14} /> Rapports de Crash
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex items-center">
                        {isScrolledUp && (
                            <button
                                onClick={scrollToBottom}
                                className="text-xs text-success hover:text-success/80 transition-colors font-mono mr-4 flex items-center gap-1"
                                title="Reprendre la lecture auto"
                            >
                                <ArrowDownToLine size={12} />
                                down
                            </button>
                        )}
                        <button
                            onClick={() => clear()}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
                            title="Clear console"
                        >
                            clear
                        </button>
                    </div>
                </div>

                {/* Log output */}
                <div
                    ref={containerRef}
                    className="flex-1 bg-[#0d0d0d] text-[#d4d4d4] overflow-y-auto overflow-x-hidden py-2 font-mono text-[13px]"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 #0d0d0d' }}
                    onClick={() => inputRef.current?.focus()}
                    onScroll={handleScroll}
                >
                    {lines.length > 0 ? (
                        lines.map((line, i) => <LogLine key={i} line={line} />)
                    ) : (
                        <div className="text-muted-foreground px-3 py-8 text-center">En attente de logs...</div>
                    )}
                </div>

                {/* Input */}
                <div className="bg-surface-hover/50 border-t border-border shrink-0">
                    <form onSubmit={sendCommand} className="flex items-center bg-[#0d0d0d] border border-border/50 overflow-hidden">
                        <div className="pl-3 pr-2 flex items-center justify-center select-none shrink-0 text-success">
                            <ChevronRight size={18} strokeWidth={2.5} />
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            disabled={!canSend}
                            placeholder={canSend ? "Entrer une commande RCON..." : "Lecture seule (Permission requise)"}
                            className="flex-1 bg-transparent text-[#d4d4d4] py-2.5 pr-2 font-mono text-[14px] focus:outline-none disabled:opacity-50"
                            value={command}
                            onChange={e => setCommand(e.target.value)}
                            onKeyDown={handleKeyDown}
                            spellCheck={false}
                            autoComplete="off"
                        />
                        <button
                            type="submit"
                            disabled={!command.trim() || !canSend}
                            className="text-muted-foreground hover:text-success disabled:opacity-0 px-3 py-2 transition-all flex items-center justify-center"
                            title="Envoyer la commande"
                        >
                            <CornerDownLeft size={16} strokeWidth={2} />
                        </button>
                    </form>
                </div>
            </div>

            {/* Crashes View */}
            <div className={`flex flex-col h-full overflow-hidden bg-surface ${viewMode === 'crashes' ? 'flex' : 'hidden'}`}>
                <div className="flex items-center gap-2 px-4 py-2 bg-surface-hover border-b border-border select-none shrink-0 justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1.5 mr-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                        </div>
                        <div className="flex bg-black/20 rounded-lg p-0.5 border border-border/50">
                            <button onClick={() => setViewMode('console')} className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'console' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}>
                                <Terminal size={14} /> Console
                            </button>
                            <button onClick={() => setViewMode('host')} className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'host' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}>
                                <Server size={14} /> Terminal Hôte
                            </button>
                            <button onClick={() => setViewMode('crashes')} className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'crashes' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}>
                                <Bug size={14} /> Rapports de Crash
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="w-64 border-r border-border bg-surface-hover/20 overflow-y-auto">
                        <div className="p-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider border-b border-border">Fichiers ({crashes.length})</div>
                        {crashes.length === 0 ? (
                            <div className="p-4 text-center text-sm text-muted-foreground">Aucun crash report</div>
                        ) : (
                            crashes.map(crash => (
                                <button
                                    key={crash}
                                    onClick={() => viewCrash(crash)}
                                    className="w-full text-left px-4 py-3 border-b border-border/50 hover:bg-white/5 transition-colors flex items-center gap-2 text-sm"
                                >
                                    <FileText size={16} className="text-danger" />
                                    <span className="truncate">{crash}</span>
                                </button>
                            ))
                        )}
                    </div>
                    <div className="flex-1 bg-[#0d0d0d] text-[#d4d4d4] overflow-y-auto font-mono text-[13px] p-4">
                        {isLoadingCrash ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground">Chargement...</div>
                        ) : selectedCrashContent ? (
                            <div className="whitespace-pre-wrap">{selectedCrashContent}</div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">Sélectionnez un rapport de crash à gauche pour le lire.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Host Terminal View */}
            <div className={`flex flex-col h-full overflow-hidden bg-surface ${viewMode === 'host' ? 'flex' : 'hidden'}`}>
                <div className="flex items-center gap-2 px-4 py-2 bg-surface-hover border-b border-border select-none shrink-0 justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1.5 mr-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                        </div>
                        <div className="flex bg-black/20 rounded-lg p-0.5 border border-border/50">
                            <button onClick={() => setViewMode('console')} className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'console' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}>
                                <Terminal size={14} /> Console
                            </button>
                            <button onClick={() => setViewMode('host')} className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'host' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}>
                                <Server size={14} /> Terminal Hôte
                            </button>
                            <button onClick={() => setViewMode('crashes')} className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'crashes' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}>
                                <Bug size={14} /> Rapports de Crash
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => setHostLines([])}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
                    >
                        clear
                    </button>
                </div>

                <div
                    ref={hostContainerRef}
                    className="flex-1 bg-[#0d0d0d] overflow-y-auto py-2 font-mono text-[13px]"
                    onClick={() => hostInputRef.current?.focus()}
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 #0d0d0d' }}
                >
                    {hostLines.length > 0 ? (
                        hostLines.map((line, i) => (
                            <div key={i} className={`whitespace-pre-wrap px-4 py-1 hover:bg-white/5 break-all ${
                                line.type === 'input' ? 'text-primary font-bold' : 
                                line.type === 'error' ? 'text-danger' : 
                                'text-[#d4d4d4]'
                            }`}>
                                {line.text}
                            </div>
                        ))
                    ) : (
                        <div className="text-muted-foreground px-4 py-8 text-center flex flex-col items-center gap-2">
                            <Terminal size={32} className="opacity-50" />
                            <p>Prêt à exécuter des commandes sur l'hôte via SSH...</p>
                            <p className="text-xs opacity-75">Connecté au VPN Hôte</p>
                        </div>
                    )}
                    {isHostExecuting && (
                        <div className="px-4 py-1 text-muted-foreground flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></div>
                            Exécution en cours...
                        </div>
                    )}
                </div>

                <div className="bg-surface-hover/50 border-t border-border shrink-0">
                    <form onSubmit={sendHostCommand} className="flex items-center bg-[#0d0d0d] border border-border/50 overflow-hidden">
                        <div className="pl-3 pr-2 flex items-center justify-center select-none shrink-0 text-primary">
                            <ChevronRight size={18} strokeWidth={2.5} />
                        </div>
                        <input
                            ref={hostInputRef}
                            type="text"
                            disabled={isHostExecuting}
                            placeholder={isHostExecuting ? "Veuillez patienter..." : "Exécuter une commande sur l'hôte..."}
                            className="flex-1 bg-transparent text-[#d4d4d4] py-2.5 pr-2 font-mono text-[14px] focus:outline-none disabled:opacity-50"
                            value={hostCommand}
                            onChange={e => setHostCommand(e.target.value)}
                            onKeyDown={handleHostKeyDown}
                            spellCheck={false}
                            autoComplete="off"
                        />
                        <button
                            type="submit"
                            disabled={!hostCommand.trim() || isHostExecuting}
                            className="text-muted-foreground hover:text-primary disabled:opacity-0 px-3 py-2 transition-all flex items-center justify-center"
                        >
                            <CornerDownLeft size={16} strokeWidth={2} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

