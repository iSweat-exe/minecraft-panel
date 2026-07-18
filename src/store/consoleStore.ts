import { create } from 'zustand';

interface ConsoleState {
    lines: string[];
    history: string[];
    historyIndex: number;
    pushLine: (line: string) => void;
    pushHistory: (cmd: string) => void;
    setHistoryIndex: (i: number) => void;
    clear: () => void;
    savedScrollTop: number | null;
    isScrolledUp: boolean;
    setScrollState: (scrollTop: number | null, isScrolledUp: boolean) => void;
}

export const useConsoleStore = create<ConsoleState>((set) => ({
    lines: [],
    history: [],
    historyIndex: -1,
    pushLine: (line) => set((s) => ({ lines: [...s.lines.slice(-999), line] })),
    pushHistory: (cmd) => set((s) => ({
        history: [...s.history, cmd],
        historyIndex: -1,
    })),
    setHistoryIndex: (i) => set({ historyIndex: i }),
    clear: () => set({ lines: [] }),
    savedScrollTop: null,
    isScrolledUp: false,
    setScrollState: (scrollTop, isScrolledUp) => set({ savedScrollTop: scrollTop, isScrolledUp }),
}));
