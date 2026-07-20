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
    hourPoints: DataPoint[]; // 10s interval, max 360 (1h)
    dayPoints: DataPoint[]; // 5m interval, max 288 (24h)
    
    lastHourUpdate: number;
    lastDayUpdate: number;

    addPoint: (point: DataPoint) => void;
    clearHistory: () => void;
}

export const useServerStatsStore = create<StatsState>((set) => ({
    rawPoints: [],
    hourPoints: [],
    dayPoints: [],
    lastHourUpdate: 0,
    lastDayUpdate: 0,
    
    addPoint: (point) => set((state) => {
        // Keep max 900 raw points (15 minutes at 1s resolution)
        const raw = [...state.rawPoints, point].slice(-900);
        
        let hour = state.hourPoints;
        let day = state.dayPoints;
        let lastH = state.lastHourUpdate;
        let lastD = state.lastDayUpdate;

        // Push to hour array every 10 seconds (10000 ms)
        if (point.ts - state.lastHourUpdate >= 10000 || state.lastHourUpdate === 0) {
            hour = [...hour, point].slice(-360);
            lastH = point.ts;
        }
        
        // Push to day array every 5 minutes (300000 ms)
        if (point.ts - state.lastDayUpdate >= 300000 || state.lastDayUpdate === 0) {
            day = [...day, point].slice(-288);
            lastD = point.ts;
        }

        return { 
            rawPoints: raw, 
            hourPoints: hour, 
            dayPoints: day, 
            lastHourUpdate: lastH, 
            lastDayUpdate: lastD 
        };
    }),
    
    clearHistory: () => set({ 
        rawPoints: [], 
        hourPoints: [], 
        dayPoints: [], 
        lastHourUpdate: 0, 
        lastDayUpdate: 0 
    })
}));
