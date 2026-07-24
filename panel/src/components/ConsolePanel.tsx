import React from 'react';
import { colorizeLogLine } from '../lib/ansiParser';
import { useConsole } from '../hooks/useConsole';
import { usePermissionStore } from '../store/permissionStore';
import { useConnectionStore } from '../store/connectionStore';
import { useActiveServerStore } from '../store/activeServerStore';
import { tauriBridge } from '../lib/tauriBridge';
import { ChevronRight, CornerDownLeft, ArrowDownToLine, Terminal, Bug, FileText, Server } from 'lucide-react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

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

const HostTerminal: React.FC<{
    host: string;
    port: string;
    token: string;
    onClearRef: React.MutableRefObject<(() => void) | null>;
}> = ({ host, port, token, onClearRef }) => {
    const termRef = React.useRef<HTMLDivElement>(null);
    const xtermRef = React.useRef<XTerm | null>(null);
    const fitAddonRef = React.useRef<FitAddon | null>(null);
    const wsRef = React.useRef<WebSocket | null>(null);

    React.useEffect(() => {
        if (!termRef.current) return;
        
        const term = new XTerm({
            theme: {
                background: '#0d0d0d',
                foreground: '#d4d4d4',
                cursor: '#d4d4d4',
                cursorAccent: '#0d0d0d',
                selectionBackground: 'rgba(255, 255, 255, 0.3)',
            },
            fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
            fontSize: 13,
            cursorBlink: true,
            convertEol: false, // PTY handles \r\n natively
            disableStdin: false,
        });
        
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(termRef.current);
        
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;
        onClearRef.current = () => term.clear();

        const wsUrl = `ws://${host}:${port}/api/v1/system/host/pty?token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            const dims = fitAddon.proposeDimensions();
            if (dims) {
                ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
            }
        };

        ws.onmessage = async (e) => {
            if (e.data instanceof Blob) {
                const text = await e.data.text();
                term.write(text);
            } else {
                term.write(e.data);
            }
        };

        ws.onclose = () => {
            term.writeln('\r\n\x1b[31m[Déconnecté du Terminal Hôte]\x1b[0m');
        };

        term.onData(data => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(new TextEncoder().encode(data));
            }
        });

        const handleResize = () => {
            fitAddon.fit();
            const dims = fitAddon.proposeDimensions();
            if (dims && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
            }
        };
        
        window.addEventListener('resize', handleResize);
        
        // Wait a tick before fitting
        setTimeout(() => handleResize(), 50);
        
        return () => {
            window.removeEventListener('resize', handleResize);
            term.dispose();
            ws.close();
            onClearRef.current = null;
        };
    }, [host, port, token, onClearRef]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 bg-[#0d0d0d] overflow-hidden p-2">
                <div ref={termRef} className="w-full h-full" />
            </div>
        </div>
    );
};

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
    const { activeServerId, getActiveServerPath } = useActiveServerStore();
    
    const canSend = can('console.send');
    const [viewMode, setViewMode] = React.useState<'console' | 'crashes' | 'host'>('console');
    const [crashes, setCrashes] = React.useState<string[]>([]);
    const [selectedCrashContent, setSelectedCrashContent] = React.useState<string | null>(null);
    const [isLoadingCrash, setIsLoadingCrash] = React.useState(false);

    // We no longer need all these state variables since they are inside HostTerminal component
    const hostClearRef = React.useRef<(() => void) | null>(null);

    const loadCrashes = React.useCallback(async () => {
        if (!host || !port || !token) return;
        const nodeUrl = `http://${host}:${port}`;
        try {
            const res = await tauriBridge.nodeGetServerCrashes(nodeUrl, token, activeServerId);
            setCrashes(res.crash_reports || []);
        } catch (e) {
            console.error("Failed to load crashes", e);
        }
    }, [host, port, token, activeServerId]);

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
            const serverPath = getActiveServerPath();
            const path = `${serverPath}/crash-reports/${filename}`;
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
                        onClick={() => hostClearRef.current?.()}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
                    >
                        clear
                    </button>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {host && port && token && viewMode === 'host' && (
                        <HostTerminal host={host} port={port} token={token} onClearRef={hostClearRef} />
                    )}
                </div>
            </div>
        </div>
    );
};

