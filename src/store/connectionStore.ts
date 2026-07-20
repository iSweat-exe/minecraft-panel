import { create } from 'zustand';
import { ConnectionState, ServiceState, McPing } from '../lib/tauriBridge';

export type PendingAction = 'starting' | 'stopping' | 'restarting' | null;

interface StoreState {
    sshStatus: ConnectionState;
    setSshStatus: (status: ConnectionState) => void;
    host: string;
    setHost: (host: string) => void;
    serviceStatus: ServiceState | null;
    setServiceStatus: (status: ServiceState | null) => void;
    mcPing: McPing | null;
    setMcPing: (ping: McPing | null) => void;
    pendingAction: PendingAction;
    setPendingAction: (action: PendingAction) => void;
    countdownAction: 'stop' | 'restart' | null;
    setCountdownAction: (action: 'stop' | 'restart' | null) => void;
    forceActionCallback: (() => void) | null;
    setForceActionCallback: (cb: (() => void) | null) => void;
}

export const useConnectionStore = create<StoreState>((set) => ({
    sshStatus: 'disconnected',
    setSshStatus: (status) => set({ sshStatus: status }),
    host: '',
    setHost: (host) => set({ host }),
    serviceStatus: null,
    setServiceStatus: (status) => set({ serviceStatus: status }),
    mcPing: null,
    setMcPing: (ping) => set({ mcPing: ping }),
    pendingAction: null,
    setPendingAction: (action) => set({ pendingAction: action }),
    countdownAction: null,
    setCountdownAction: (action) => set({ countdownAction: action }),
    forceActionCallback: null,
    setForceActionCallback: (cb) => set({ forceActionCallback: cb }),
}));
