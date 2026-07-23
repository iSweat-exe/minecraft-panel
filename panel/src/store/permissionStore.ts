import { create } from 'zustand';
import { PanelUser } from '../types/permissions';
import { tauriBridge } from '../lib/tauriBridge';
import { logAction } from '../lib/actionLogger';

interface PermissionStore {
    users: PanelUser[];
    currentUser: PanelUser | null;
    loading: boolean;
    fetchUsers: () => Promise<void>;
    saveUser: (user: PanelUser) => Promise<void>;
    deleteUser: (username: string) => Promise<void>;
    can: (permission: string) => boolean;
}

export const usePermissionStore = create<PermissionStore>((set, get) => ({
    users: [],
    currentUser: null,
    loading: false,

    fetchUsers: async () => {
        set({ loading: true });
        try {
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            if (!host || !token) throw new Error("Daemon credentials missing");
            const nodeUrl = `http://${host}:${port}`;

            const users = await tauriBridge.getPanelUsers(nodeUrl, token);
            const storedUsername = localStorage.getItem('panel_username') || 'admin';
            
            // Find current user or fallback to admin permissions
            const isSubuserMode = localStorage.getItem('panel_login_mode') === 'subuser';
            let current = users.find(u => u.username.toLowerCase() === storedUsername.toLowerCase());
            if (!current) {
                current = {
                    username: storedUsername,
                    role: isSubuserMode ? 'subuser' : 'admin',
                    permissions: isSubuserMode ? [] : ['*']
                };
            }

            set({ users, currentUser: current, loading: false });
        } catch {
            const storedUsername = localStorage.getItem('panel_username') || 'admin';
            const isSubuserMode = localStorage.getItem('panel_login_mode') === 'subuser';
            set({
                users: [],
                currentUser: { username: storedUsername, role: isSubuserMode ? 'subuser' : 'admin', permissions: isSubuserMode ? [] : ['*'] },
                loading: false
            });
        }
    },

    saveUser: async (user) => {
        set({ loading: true });
        try {
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            if (!host || !token) throw new Error("Daemon credentials missing");
            const nodeUrl = `http://${host}:${port}`;

            const updated = await tauriBridge.savePanelUser(nodeUrl, token, user);
            await logAction(`Sauvegarde de l'utilisateur ${user.username}`, { role: user.role, permissions: user.permissions });
            const storedUsername = localStorage.getItem('panel_username') || 'admin';
            let current = updated.find(u => u.username.toLowerCase() === storedUsername.toLowerCase());
            if (!current) {
                current = { username: storedUsername, role: 'admin', permissions: ['*'] };
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
            const token = localStorage.getItem('node_token');
            if (!host || !token) throw new Error("Daemon credentials missing");
            const nodeUrl = `http://${host}:${port}`;

            const updated = await tauriBridge.deletePanelUser(nodeUrl, token, username);
            await logAction(`Suppression de l'utilisateur ${username}`, { username });
            const storedUsername = localStorage.getItem('panel_username') || 'admin';
            let current = updated.find(u => u.username.toLowerCase() === storedUsername.toLowerCase());
            if (!current) {
                current = { username: storedUsername, role: 'admin', permissions: ['*'] };
            }
            set({ users: updated, currentUser: current, loading: false });
        } catch (e: any) {
            set({ loading: false });
            throw e;
        }
    },

    can: (permission: string) => {
        const { currentUser } = get();
        if (!currentUser) return true; // Default open if not logged in
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
