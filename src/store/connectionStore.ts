import { create } from 'zustand';
import { ConnectionState, ServiceState } from '../lib/tauriBridge';

interface StoreState {
    sshStatus: ConnectionState;
    setSshStatus: (status: ConnectionState) => void;
    serviceStatus: ServiceState | null;
    setServiceStatus: (status: ServiceState | null) => void;
}

export const useConnectionStore = create<StoreState>((set) => ({
    sshStatus: 'disconnected',
    setSshStatus: (status) => set({ sshStatus: status }),
    serviceStatus: null,
    setServiceStatus: (status) => set({ serviceStatus: status }),
}));
