import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import { tauriBridge } from '../lib/tauriBridge';
import { RotateCw } from 'lucide-react';
import { UnlistenFn } from '@tauri-apps/api/event';

export const TerminalComponent: React.FC = () => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [reconnectKey, setReconnectKey] = useState(0);

    useEffect(() => {
        let isCancelled = false;
        let unlistenData: UnlistenFn | undefined;
        let unlistenExit: UnlistenFn | undefined;
        let onDataDisposable: { dispose: () => void } | undefined;
        let resizeObserver: ResizeObserver | undefined;
        let term: Terminal | undefined;

        // Suppress known xterm.js internal race condition when unmounting
        const handleGlobalError = (event: ErrorEvent) => {
            if (event.message && event.message.includes("reading 'dimensions'")) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };
        window.addEventListener('error', handleGlobalError);

        const setup = async () => {
            if (!terminalRef.current) return;

            term = new Terminal({
                cursorBlink: true,
                cursorStyle: 'block',
                fontSize: 13,
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                theme: {
                    background: '#0d0d0d',
                    foreground: '#d4d4d4',
                    cursor: '#6366f1',
                    selectionBackground: 'rgba(99, 102, 241, 0.3)',
                    black: '#000000',
                    red: '#ef4444',
                    green: '#22c55e',
                    yellow: '#eab308',
                    blue: '#3b82f6',
                    magenta: '#ec4899',
                    cyan: '#06b6d4',
                    white: '#f3f4f6',
                    brightBlack: '#4b5563',
                    brightRed: '#f87171',
                    brightGreen: '#4ade80',
                    brightYellow: '#fde047',
                    brightBlue: '#60a5fa',
                    brightMagenta: '#f472b6',
                    brightCyan: '#22d3ee',
                    brightWhite: '#ffffff',
                },
                convertEol: true,
            });

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);

            term.open(terminalRef.current);
            if (terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
                try {
                    fitAddon.fit();
                } catch {
                    // Ignore initial layout dimension errors
                }
            }

            xtermRef.current = term;
            fitAddonRef.current = fitAddon;

            if (isCancelled) {
                try { term.dispose(); } catch {}
                return;
            }

            const cols = term.cols || 80;
            const rows = term.rows || 24;

            try {
                await tauriBridge.terminalStart(cols, rows);
            } catch (e) {
                if (!isCancelled && term) {
                    try {
                        term.writeln(`\r\n\x1b[31m[Error starting terminal session: ${e}]\x1b[0m\r\n`);
                    } catch {}
                }
            }

            if (isCancelled) {
                try { term.dispose(); } catch {}
                return;
            }

            // Forward keystrokes to backend
            onDataDisposable = term.onData(data => {
                const bytes = Array.from(new TextEncoder().encode(data));
                tauriBridge.terminalWrite(bytes).catch(() => {});
            });

            // Listen for backend stdout/stderr
            unlistenData = await tauriBridge.onTerminalData(data => {
                if (!isCancelled && xtermRef.current) {
                    try {
                        xtermRef.current.write(new Uint8Array(data));
                    } catch {
                        // Safe catch if terminal is unmounting or hidden
                    }
                }
            });

            unlistenExit = await tauriBridge.onTerminalExit(() => {
                if (!isCancelled && xtermRef.current) {
                    try {
                        xtermRef.current.writeln('\r\n\x1b[33m[SSH Session closed]\x1b[0m\r\n');
                    } catch {}
                }
            });

            if (isCancelled) {
                if (onDataDisposable) onDataDisposable.dispose();
                if (unlistenData) unlistenData();
                if (unlistenExit) unlistenExit();
                try { term.dispose(); } catch {}
                return;
            }

            // Handle auto-fit on window / element resize
            resizeObserver = new ResizeObserver(() => {
                if (fitAddonRef.current && xtermRef.current && terminalRef.current) {
                    if (terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
                        try {
                            fitAddonRef.current.fit();
                            const newCols = xtermRef.current.cols;
                            const newRows = xtermRef.current.rows;
                            if (newCols > 0 && newRows > 0) {
                                tauriBridge.terminalResize(newCols, newRows).catch(() => {});
                            }
                        } catch {
                            // Ignore resize race conditions
                        }
                    }
                }
            });

            if (terminalRef.current) {
                resizeObserver.observe(terminalRef.current);
            }
        };

        setup();

        return () => {
            isCancelled = true;
            window.removeEventListener('error', handleGlobalError);
            if (onDataDisposable) try { onDataDisposable.dispose(); } catch {}
            if (unlistenData) try { unlistenData(); } catch {}
            if (unlistenExit) try { unlistenExit(); } catch {}
            if (resizeObserver) try { resizeObserver.disconnect(); } catch {}
            if (terminalRef.current) try { terminalRef.current.replaceChildren(); } catch {}
            if (term) try { term.dispose(); } catch {}
            xtermRef.current = null;
            fitAddonRef.current = null;
        };
    }, [reconnectKey]);

    return (
        <div className="flex flex-col h-full bg-[#0d0d0d] relative overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-surface-hover/80 border-b border-border/50 select-none">
                <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    Terminal VPS (SSH Bash)
                </span>
                <button
                    onClick={() => setReconnectKey(k => k + 1)}
                    className="text-muted-foreground hover:text-foreground text-xs p-1 rounded hover:bg-surface transition-colors"
                    title="Reconnecter le terminal"
                >
                    <RotateCw size={12} />
                </button>
            </div>
            <div className="flex-1 p-2 overflow-hidden" ref={terminalRef} />
        </div>
    );
};
