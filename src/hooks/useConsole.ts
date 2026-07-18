import { useState, useCallback, useEffect, useRef } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConsoleStore } from '../store/consoleStore';

export function useConsole() {
    const { lines, pushLine, history, historyIndex, pushHistory, setHistoryIndex, clear } = useConsoleStore();
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

    return {
        lines,
        command,
        setCommand,
        containerRef,
        inputRef,
        clear,
        sendCommand,
        handleKeyDown
    };
}
