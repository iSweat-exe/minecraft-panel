import React from 'react';
import { colorizeLogLine } from '../lib/ansiParser';
import { useConsole } from '../hooks/useConsole';
import { usePermissionStore } from '../store/permissionStore';
import { ChevronRight, CornerDownLeft, ArrowDownToLine } from 'lucide-react';
import { TerminalComponent } from './TerminalComponent';

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
    const { can, currentUser } = usePermissionStore();
    const canSend = can('console.send');
    const isAdmin = currentUser?.role === 'admin';
    const [viewMode, setViewMode] = React.useState<'split' | 'mc' | 'vps'>('split');

    return (
        <div className="flex flex-col h-full overflow-hidden bg-surface border border-border">
            {/* View Mode Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-surface-hover/60 border-b border-border select-none shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">Console Multi-Vues</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">Split-screen actif</span>
                </div>
                {isAdmin && (
                    <div className="flex bg-surface border border-border rounded-lg p-0.5 text-xs font-mono">
                        <button
                            onClick={() => setViewMode('split')}
                            className={`px-2.5 py-1 rounded-md transition-all ${viewMode === 'split' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Split (50/50)
                        </button>
                        <button
                            onClick={() => setViewMode('mc')}
                            className={`px-2.5 py-1 rounded-md transition-all ${viewMode === 'mc' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Minecraft
                        </button>
                        <button
                            onClick={() => setViewMode('vps')}
                            className={`px-2.5 py-1 rounded-md transition-all ${viewMode === 'vps' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Terminal VPS
                        </button>
                    </div>
                )}
            </div>

            {/* Split Content Area */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border min-h-0">
                {/* Left Pane: Minecraft Docker Console */}
                {(viewMode === 'split' || viewMode === 'mc') && (
                    <div className={`flex flex-col h-full overflow-hidden bg-surface ${viewMode === 'mc' ? 'lg:col-span-2' : ''}`}>
                        {/* Title bar mimicking a real terminal */}
                        <div className="flex items-center gap-2 px-4 py-2 bg-surface-hover border-b border-border select-none shrink-0">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                            </div>
                            <span className="text-xs text-muted-foreground ml-2 font-mono flex-1 truncate">minecraft@server — docker logs</span>
                            {isScrolledUp && (
                                <button
                                    onClick={scrollToBottom}
                                    className="text-xs text-success hover:text-success/80 transition-colors font-mono mr-2 flex items-center gap-1"
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
                                <div className="text-muted-foreground px-3 py-8 text-center">Waiting for logs...</div>
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
                )}

                {/* Right Pane: VPS Terminal */}
                {isAdmin && (viewMode === 'split' || viewMode === 'vps') && (
                    <div className={`flex flex-col h-full overflow-hidden ${viewMode === 'vps' ? 'lg:col-span-2' : ''}`}>
                        <TerminalComponent />
                    </div>
                )}
            </div>
        </div>
    );
};
