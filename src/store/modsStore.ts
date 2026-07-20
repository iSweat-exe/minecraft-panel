import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ModsState {
    modPath: string;
    curseforgeApiKey: string;
    warnOnClientMods: boolean;
    setModPath: (path: string) => void;
    setCurseforgeApiKey: (key: string) => void;
    setWarnOnClientMods: (warn: boolean) => void;
}

export const useModsStore = create<ModsState>()(
    persist(
        (set) => ({
            modPath: '~/minecraft/mods/',
            curseforgeApiKey: '',
            warnOnClientMods: true,
            setModPath: (path) => set({ modPath: path }),
            setCurseforgeApiKey: (key) => set({ curseforgeApiKey: key }),
            setWarnOnClientMods: (warn) => set({ warnOnClientMods: warn }),
        }),
        {
            name: 'mods-storage',
        }
    )
);
