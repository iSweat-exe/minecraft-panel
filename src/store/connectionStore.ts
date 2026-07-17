import { create } from 'zustand';
import { ConnectionState, ServiceState, McPing } from '../lib/tauriBridge';

interface StoreState {
    sshStatus: ConnectionState;
    setSshStatus: (status: ConnectionState) => void;
    serviceStatus: ServiceState | null;
    setServiceStatus: (status: ServiceState | null) => void;
    mcPing: McPing | null;
    setMcPing: (ping: McPing | null) => void;
}

export const useConnectionStore = create<StoreState>((set) => ({
    sshStatus: 'disconnected',
    setSshStatus: (status) => set({ sshStatus: status }),
    serviceStatus: null,
    setServiceStatus: (status) => set({ serviceStatus: status }),
    mcPing: null,
    setMcPing: (ping) => set({ mcPing: ping }),
}));
