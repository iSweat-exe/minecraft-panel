import React from 'react';
import { colorizeLogLine } from '../lib/ansiParser';
import { useConsole } from '../hooks/useConsole';
import { ChevronRight, CornerDownLeft, ArrowDownToLine } from 'lucide-react';

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

    return (
        <div className="bg-zinc-900 border border-zinc-800 flex flex-col h-full overflow-hidden">
            {/* Title bar mimicking a real terminal */}
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border-b border-zinc-700 select-none">
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <span className="text-xs text-zinc-500 ml-2 font-mono flex-1">minecraft@server — tail -F logs/latest.log</span>
                {isScrolledUp && (
                    <button
                        onClick={scrollToBottom}
                        className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors font-mono mr-2 flex items-center gap-1"
                        title="Reprendre la lecture auto"
                    >
                        <ArrowDownToLine size={12} />
                        down
                    </button>
                )}
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
                onScroll={handleScroll}
            >
                {lines.length > 0 ? (
                    lines.map((line, i) => <LogLine key={i} line={line} />)
                ) : (
                    <div className="text-zinc-600 px-3 py-8 text-center">Waiting for logs...</div>
                )}
            </div>

            {/* Input */}
            <div className="bg-zinc-900/50 border-t border-zinc-800 shrink-0">
                <form onSubmit={sendCommand} className="flex items-center bg-[#0d0d0d] border border-zinc-700/50 overflow-hidden">
                    <div className="pl-3 pr-2 flex items-center justify-center select-none shrink-0 text-emerald-500">
                        <ChevronRight size={18} strokeWidth={2.5} />
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent text-[#d4d4d4] py-2.5 pr-2 font-mono text-[14px] focus:outline-none"
                        value={command}
                        onChange={e => setCommand(e.target.value)}
                        onKeyDown={handleKeyDown}
                        spellCheck={false}
                        autoComplete="off"
                    />
                    <button
                        type="submit"
                        disabled={!command.trim()}
                        className="text-zinc-500 hover:text-emerald-400 disabled:opacity-0 px-3 py-2 transition-all flex items-center justify-center"
                        title="Envoyer la commande"
                    >
                        <CornerDownLeft size={16} strokeWidth={2} />
                    </button>
                </form>
            </div>
        </div>
    );
};
