import { create } from 'zustand';

export interface PanelSession {
    uuid: string;
    name: string;
    connectedAt: number;
    lastSeen: number;
    ip?: string;
    ipv6?: string;
    location?: string;
    os?: string;
    avatar?: string;
}

interface SessionStore {
    sessions: PanelSession[];
    setSessions: (sessions: PanelSession[]) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
    sessions: [],
    setSessions: (sessions) => set({ sessions })
}));
