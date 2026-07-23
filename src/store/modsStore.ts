import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ModsState {
    modPath: string;
    curseforgeApiKey: string;
    warnOnClientMods: boolean;
    modsPerPage: number;
    lastSelectedVersion: string;
    lastSelectedLoader: string;
    setModPath: (path: string) => void;
    setCurseforgeApiKey: (key: string) => void;
    setWarnOnClientMods: (warn: boolean) => void;
    setModsPerPage: (limit: number) => void;
    setLastSelectedVersion: (version: string) => void;
    setLastSelectedLoader: (loader: string) => void;
}

export const useModsStore = create<ModsState>()(
    persist(
        (set) => ({
            modPath: '/minecraft/mods',
            curseforgeApiKey: '',
            warnOnClientMods: true,
            modsPerPage: 15,
            lastSelectedVersion: 'all',
            lastSelectedLoader: 'all',
            setModPath: (path) => set({ modPath: path }),
            setCurseforgeApiKey: (key) => set({ curseforgeApiKey: key }),
            setWarnOnClientMods: (warn) => set({ warnOnClientMods: warn }),
            setModsPerPage: (limit) => set({ modsPerPage: limit }),
            setLastSelectedVersion: (version) => set({ lastSelectedVersion: version }),
            setLastSelectedLoader: (loader) => set({ lastSelectedLoader: loader }),
        }),
        {
            name: 'mods-storage',
        }
    )
);
