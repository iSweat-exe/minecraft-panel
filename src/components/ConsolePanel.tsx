import React from 'react';
import { colorizeLogLine } from '../lib/ansiParser';
import { useConsole } from '../hooks/useConsole';

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
        handleKeyDown
    } = useConsole();

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col h-full overflow-hidden">
            {/* Title bar mimicking a real terminal */}
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border-b border-zinc-700 select-none">
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <span className="text-xs text-zinc-500 ml-2 font-mono flex-1">minecraft@server — tail -F logs/latest.log</span>
                <button
                    onClick={() => clear()}
                    className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors font-mono"
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
