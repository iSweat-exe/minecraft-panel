import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ActiveServerState {
    activeServerId: string;
    setActiveServerId: (id: string) => void;
    getActiveServerPath: () => string;
}

export const useActiveServerStore = create<ActiveServerState>()(
    persist(
        (set, get) => ({
            activeServerId: 'default',
            setActiveServerId: (id) => set({ activeServerId: id }),
            getActiveServerPath: () => {
                const id = get().activeServerId;
                return id === 'default' ? '/minecraft' : `/minecraft-${id}`;
            }
        }),
        {
            name: 'active-server-storage',
        }
    )
);
