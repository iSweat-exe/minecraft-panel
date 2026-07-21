import { create } from 'zustand';

export interface DataPoint {
    time: string;
    ts: number;
    cpu: number;
    ram: number;
    rx: number;
    tx: number;
}

interface StatsState {
    rawPoints: DataPoint[]; // 1s interval, max 900 (15m)
    historicalPoints: DataPoint[]; // 1min interval, max 1440 (24h)


    addPoint: (point: DataPoint) => void;
    loadHistory: (points: DataPoint[]) => void;
    clearHistory: () => void;
}

export const useServerStatsStore = create<StatsState>((set) => ({
    rawPoints: [],
    historicalPoints: [],
    
    addPoint: (point) => set((state) => {
        // Keep max 900 raw points (15 minutes at 1s resolution)
        const raw = [...state.rawPoints, point].slice(-900);
        
        return { 
            rawPoints: raw
        };
    }),
    
    loadHistory: (points) => set((state) => {
        return {
            ...state,
            historicalPoints: points
        };
    }),
    
    clearHistory: () => set({ 
        rawPoints: [], 
        historicalPoints: []
    })
}));
