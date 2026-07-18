import { useState, useCallback, useEffect, useRef } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConsoleStore } from '../store/consoleStore';

export function useConsole() {
    const { lines, pushLine, history, historyIndex, pushHistory, setHistoryIndex, clear, savedScrollTop, isScrolledUp: storeIsScrolledUp, setScrollState } = useConsoleStore();
    const [command, setCommand] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [isScrolledUpState, setIsScrolledUpState] = useState(storeIsScrolledUp);
    const isScrolledUp = useRef(storeIsScrolledUp);

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

    // Initial scroll on mount & save on unmount
    useEffect(() => {
        if (containerRef.current) {
            if (isScrolledUp.current && savedScrollTop !== null) {
                // Restore scroll position
                containerRef.current.scrollTop = savedScrollTop;
            } else {
                // Scroll to bottom
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
                isScrolledUp.current = false;
                setIsScrolledUpState(false);
            }
        }

        return () => {
            if (containerRef.current) {
                setScrollState(containerRef.current.scrollTop, isScrolledUp.current);
            }
        };
    }, []); // Ignore deps, we only want mount/unmount

    // Auto scroll on new lines only if user hasn't scrolled up
    useEffect(() => {
        if (containerRef.current && !isScrolledUp.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [lines.length]);

    const handleScroll = useCallback(() => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        // Consider "at bottom" if within 10px of the bottom
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
        
        if (isScrolledUp.current === isAtBottom) {
            isScrolledUp.current = !isAtBottom;
            setIsScrolledUpState(!isAtBottom);
        }
    }, []);

    const scrollToBottom = useCallback(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
            isScrolledUp.current = false;
            setIsScrolledUpState(false);
        }
    }, []);

    const sendCommand = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = command.trim();
        if (!trimmed) return;
        try {
            pushHistory(trimmed);
            await tauriBridge.consoleSendCommand(trimmed);
            setCommand('');
            
            // Force scroll to bottom when sending a command
            scrollToBottom();
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
        handleKeyDown,
        handleScroll,
        scrollToBottom,
        isScrolledUp: isScrolledUpState
    };
}
