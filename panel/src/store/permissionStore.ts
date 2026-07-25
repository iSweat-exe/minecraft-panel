import { create } from 'zustand';
import { PanelUser } from '../types/permissions';
import { tauriBridge } from '../lib/tauriBridge';
import { logAction } from '../lib/actionLogger';
import { getToken } from '../lib/connectionManager';

interface PermissionStore {
    users: PanelUser[];
    currentUser: PanelUser | null;
    loading: boolean;
    fetchError: string | null;
    fetchUsers: () => Promise<void>;
    saveUser: (user: PanelUser) => Promise<void>;
    deleteUser: (username: string) => Promise<void>;
    can: (permission: string) => boolean;
}

export const usePermissionStore = create<PermissionStore>((set, get) => ({
    users: [],
    currentUser: null,
    loading: false,
    fetchError: null,

    fetchUsers: async () => {
        set({ loading: true });
        try {
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = getToken();
            if (!host || !token) throw new Error("Daemon credentials missing");
            const nodeUrl = `\${Number(port) === 443 || Number(port) === 8443 ? 'https' : 'http'}://${host}:${port}`;

            const res = await tauriBridge.nodeApiRequest(nodeUrl, token, 'GET', '/api/users');
            const users = (res?.success && Array.isArray(res.data)) ? res.data : [];
            
            const storedUsername = localStorage.getItem('panel_username') || 'admin';
            
            // Find current user or fallback to admin permissions
            let current = users.find((u: any) => u.username.toLowerCase() === storedUsername.toLowerCase());
            if (!current) {
                current = {
                    username: storedUsername,
                    role: 'subuser',
                    permissions: []
                };
            }

            set({ users, currentUser: current, loading: false, fetchError: null });
        } catch (e: any) {
            set({
                users: [],
                currentUser: null,
                loading: false,
                fetchError: e?.message || 'Failed to fetch users'
            });
        }
    },

    saveUser: async (user) => {
        set({ loading: true });
        try {
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = getToken();
            if (!host || !token) throw new Error("Daemon credentials missing");
            const nodeUrl = `\${Number(port) === 443 || Number(port) === 8443 ? 'https' : 'http'}://${host}:${port}`;

            const updated = await tauriBridge.savePanelUser(nodeUrl, token, user);
            await logAction(`Sauvegarde de l'utilisateur ${user.username}`, { role: user.role, permissions: user.permissions });

            const storedUsername = localStorage.getItem('panel_username') || 'admin';
            let current = updated.find((u: any) => u.username.toLowerCase() === storedUsername.toLowerCase());
            if (!current) {
                current = { username: storedUsername, role: 'subuser', permissions: [] };
            }
            set({ users: updated, currentUser: current, loading: false });
        } catch (e: any) {
            set({ loading: false });
            throw e;
        }
    },

    deleteUser: async (username) => {
        set({ loading: true });
        try {
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = getToken();
            if (!host || !token) throw new Error("Daemon credentials missing");
            const nodeUrl = `\${Number(port) === 443 || Number(port) === 8443 ? 'https' : 'http'}://${host}:${port}`;

            const updated = await tauriBridge.deletePanelUser(nodeUrl, token, username);
            await logAction(`Suppression de l'utilisateur ${username}`, { username });

            const storedUsername = localStorage.getItem('panel_username') || 'admin';
            let current = updated.find((u: any) => u.username.toLowerCase() === storedUsername.toLowerCase());
            if (!current) {
                current = { username: storedUsername, role: 'subuser', permissions: [] };
            }
            set({ users: updated, currentUser: current, loading: false });
        } catch (e: any) {
            set({ loading: false });
            throw e;
        }
    },

    can: (permission: string) => {
        const { currentUser } = get();
        if (!currentUser) return false; // Deny access if user not loaded
        if (currentUser.role === 'admin' || currentUser.permissions.includes('*')) return true;
        
        // Exact match or wildcard category match (e.g. 'control.*')
        return currentUser.permissions.some(p => {
            if (p === permission) return true;
            if (p.endsWith('.*')) {
                const prefix = p.slice(0, -2);
                return permission.startsWith(prefix);
            }
            return false;
        });
    }
}));
