import { create } from 'zustand';

interface ConsoleState {
  lines: string[];
  pushLine: (line: string) => void;
  clear: () => void;
}

export const useConsoleStore = create<ConsoleState>((set) => ({
  lines: [],
  pushLine: (line) => set((s) => ({ lines: [...s.lines.slice(-999), line] })),
  clear: () => set({ lines: [] }),
}));
