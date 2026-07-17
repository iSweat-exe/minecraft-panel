import React, { useEffect, useState, useRef, useCallback } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConsoleStore } from '../store/consoleStore';

// Map Minecraft/ANSI color codes to CSS colors
const ANSI_COLORS: Record<string, string> = {
    '30': '#1e1e1e', '31': '#cc3333', '32': '#4e9a06', '33': '#c4a000',
    '34': '#3465a4', '35': '#9b59b6', '36': '#06989a', '37': '#d3d7cf',
    '90': '#555753', '91': '#ef5350', '92': '#8ae234', '93': '#fce94f',
    '94': '#729fcf', '95': '#ad7fa8', '96': '#34e2e2', '97': '#eeeeec',
};

interface AnsiSpan {
    text: string;
    color?: string;
    bold?: boolean;
}

function parseAnsi(line: string): AnsiSpan[] {
    const spans: AnsiSpan[] = [];
    // eslint-disable-next-line no-control-regex
    const regex = /\x1b\[([0-9;]*)m/g;
    let lastIndex = 0;
    let currentColor: string | undefined;
    let currentBold = false;

    let match;
    while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
            spans.push({ text: line.slice(lastIndex, match.index), color: currentColor, bold: currentBold });
        }
        const codes = match[1].split(';').filter(Boolean);
        for (const code of codes) {
            if (code === '0') { currentColor = undefined; currentBold = false; }
            else if (code === '1') { currentBold = true; }
            else if (ANSI_COLORS[code]) { currentColor = ANSI_COLORS[code]; }
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < line.length) {
        spans.push({ text: line.slice(lastIndex), color: currentColor, bold: currentBold });
    }
    if (spans.length === 0) {
        spans.push({ text: line });
    }
    return spans;
}

// Colorize Minecraft log levels in plain text (no ANSI)
function colorizeLogLine(line: string): AnsiSpan[] {
    // If line contains ANSI escape codes, parse them
    // eslint-disable-next-line no-control-regex
    if (/\x1b\[/.test(line)) {
        return parseAnsi(line);
    }

    // Otherwise, colorize based on log level keywords
    if (/\bWARN\b/i.test(line)) {
        return [{ text: line, color: '#c4a000' }];
    }
    if (/\bERROR\b/i.test(line)) {
        return [{ text: line, color: '#ef5350' }];
    }
    if (/\bINFO\b/i.test(line)) {
        return [{ text: line, color: '#d3d7cf' }];
    }

    return [{ text: line }];
}

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
    const { lines, pushLine, history, historyIndex, pushHistory, setHistoryIndex } = useConsoleStore();
    const [command, setCommand] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const init = async () => {
            try {
                await tauriBridge.consoleSubscribe();
            } catch (e) {
                console.error("Failed to subscribe to console", e);
            }
        };
        init();

        const unlisten = tauriBridge.onConsoleLine((line) => {
            pushLine(line);
        });

        return () => {
            unlisten.then(f => f());
        };
    }, [pushLine]);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [lines.length]);

    const sendCommand = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = command.trim();
        if (!trimmed) return;
        try {
            pushHistory(trimmed);
            await tauriBridge.consoleSendCommand(trimmed);
            setCommand('');
        } catch (e) {
            console.error("Failed to send command", e);
        }
    };

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (history.length === 0) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
            setHistoryIndex(newIndex);
            setCommand(history[newIndex]);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex === -1) return;
            const newIndex = historyIndex + 1;
            if (newIndex >= history.length) {
                setHistoryIndex(-1);
                setCommand('');
            } else {
                setHistoryIndex(newIndex);
                setCommand(history[newIndex]);
            }
        }
    }, [history, historyIndex, setHistoryIndex]);

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col h-full overflow-hidden">
            {/* Title bar mimicking a real terminal */}
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border-b border-zinc-700 select-none">
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <span className="text-xs text-zinc-500 ml-2 font-mono">minecraft@server — tail -F logs/latest.log</span>
            </div>

            {/* Log output */}
            <div
                ref={containerRef}
                className="flex-1 bg-[#0d0d0d] text-[#d4d4d4] overflow-y-auto overflow-x-hidden py-2 font-mono text-[13px]"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 #0d0d0d' }}
                onClick={() => inputRef.current?.focus()}
            >
                {lines.length > 0 ? (
                    lines.map((line, i) => <LogLine key={i} line={line} />)
                ) : (
                    <div className="text-zinc-600 px-3 py-8 text-center">Waiting for logs...</div>
                )}
            </div>

            {/* Input */}
            <form onSubmit={sendCommand} className="flex border-t border-zinc-800 bg-[#0d0d0d]">
                <span className="text-green-500 font-mono text-sm px-3 py-2.5 select-none shrink-0">$</span>
                <input
                    ref={inputRef}
                    type="text"
                    className="flex-1 bg-transparent text-[#d4d4d4] py-2.5 pr-3 font-mono text-sm focus:outline-none placeholder:text-zinc-700"
                    placeholder="say Hello..."
                    value={command}
                    onChange={e => setCommand(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button
                    type="submit"
                    className="text-zinc-500 hover:text-zinc-300 px-4 py-2.5 font-mono text-sm transition-colors"
                >
                    ↵
                </button>
            </form>
        </div>
    );
};
