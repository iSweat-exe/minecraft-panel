import { useState, useCallback, useEffect, useRef } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConsoleStore } from '../store/consoleStore';
import { logAction } from '../lib/actionLogger';

export function useConsole() {
    const { lines, pushLine, history, historyIndex, pushHistory, setHistoryIndex, clear, savedScrollTop, isScrolledUp: storeIsScrolledUp, setScrollState } = useConsoleStore();
    const [command, setCommand] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [isScrolledUpState, setIsScrolledUpState] = useState(storeIsScrolledUp);
    const isScrolledUp = useRef(storeIsScrolledUp);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        let isMounted = true;
        let ws: WebSocket | null = null;

        const connectWs = async () => {
            try {
                const host = localStorage.getItem('node_host');
                const port = localStorage.getItem('node_port') || '8080';
                const token = localStorage.getItem('node_token');
                if (!host || !token) return;

                const serverId = 'default';
                const jwtToken = await tauriBridge.nodeGenerateConsoleToken(serverId, token);
                
                // Use wss:// if connection is https, else ws://
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${host}:${port}/api/v1/servers/${serverId}/ws?token=${jwtToken}`;

                if (!isMounted) return;

                ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log("WebSocket console connected");
                };

                ws.onmessage = (event) => {
                    try {
                        const payload = JSON.parse(event.data);
                        if (payload.event === 'console_output') {
                            pushLine(payload.data.line);
                        } else if (payload.event === 'error') {
                            console.error("Console WS error:", payload.data.message);
                        }
                    } catch (e) {
                        console.error("Failed to parse console WS message", e);
                    }
                };

                ws.onclose = () => {
                    console.log("WebSocket console disconnected");
                };

            } catch (e) {
                console.error("Failed to connect to console WS", e);
            }
        };

        connectWs();

        return () => {
            isMounted = false;
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
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
    }, [lines]);

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
            pushLine(`> ${trimmed}`);
            setCommand('');
            
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    event: 'send_command',
                    data: { command: trimmed }
                }));
            } else {
                console.warn("WebSocket not connected. Cannot send command.");
            }

            logAction('Commande manuelle (Console)', { commande: trimmed });
            
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

