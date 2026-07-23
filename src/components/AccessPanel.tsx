import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { usePermissionStore } from '../store/permissionStore';
import { PanelUser } from '../types/permissions';
import { UserPermissionModal } from './dialogs/UserPermissionModal';
import { User, Shield, Plus, Key } from 'lucide-react';
import { Button } from './ui/Button';

export const AccessPanel: React.FC = () => {
    const sessions = useSessionStore(state => state.sessions);
    const { users, fetchUsers, saveUser, deleteUser, can } = usePermissionStore();
    const myUuid = localStorage.getItem('panel_session_uuid');

    const [activeTab, setActiveTab] = useState<'sessions' | 'users'>('users');
    const [modalOpen, setModalOpen] = useState<boolean>(false);
    const [editingUser, setEditingUser] = useState<PanelUser | null>(null);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const formatUptime = (minutes: number) => {
        if (minutes < 1) return '< 1m';
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours < 24) return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return `${days}j ${remainingHours > 0 ? `${remainingHours}h` : ''}`;
    };

    const handleOpenAdd = () => {
        setEditingUser(null);
        setModalOpen(true);
    };

    const handleOpenEdit = (u: PanelUser) => {
        setEditingUser(u);
        setModalOpen(true);
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative text-foreground">
            
            {/* Header */}
            <div className="p-6 pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">Gestion des Accès & Rôles</h2>
                        <p className="text-muted-foreground text-sm">
                            Surveillez les sessions en direct et gérez les permissions des sous-utilisateurs (Style Pterodactyl).
                        </p>
                    </div>
                    {can('user.create') && activeTab === 'users' && (
                        <Button onClick={handleOpenAdd} variant="primary" className="gap-2 text-xs font-semibold">
                            <Plus size={16} /> Ajouter un sous-utilisateur
                        </Button>
                    )}
                </div>

                {/* Tabs Switcher */}
                <div className="flex items-center gap-2 mt-6 border-b border-border">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                            activeTab === 'users'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Shield size={16} />
                        Sous-utilisateurs ({users.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('sessions')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                            activeTab === 'sessions'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <User size={16} />
                        Sessions actives ({sessions.length})
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                
                {/* Users / Permissions Tab */}
                {activeTab === 'users' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {users.map(user => {
                                const isAdmin = user.role === 'admin';
                                return (
                                    <div
                                        key={user.username}
                                        className="bg-surface/40 border border-border p-5 rounded-2xl flex flex-col justify-between space-y-4 hover:border-border/80 transition-all"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                {user.avatar_base64 ? (
                                                    <img
                                                        src={user.avatar_base64}
                                                        alt={user.username}
                                                        className="w-10 h-10 rounded-xl object-cover border border-border/60 shadow-sm shrink-0"
                                                    />
                                                ) : (
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                                        isAdmin ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-primary/10 text-primary border border-primary/20'
                                                    }`}>
                                                        {user.username.substring(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-foreground text-sm">
                                                            {user.display_name || user.username}
                                                        </h3>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                            isAdmin ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-primary/15 text-primary border border-primary/20'
                                                        }`}>
                                                            {isAdmin ? 'ADMIN (*)' : 'SOUS-UTILISATEUR'}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground mt-0.5 block font-mono">
                                                        @{user.username} • {isAdmin ? 'Toutes les autorisations (*)' : `${user.permissions.length} permission(s)`}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                                            <span className="text-[11px] text-muted-foreground">
                                                {isAdmin ? 'Accès illimité' : 'Accès restraint'}
                                            </span>
                                            {can('user.edit') && (
                                                <button
                                                    onClick={() => handleOpenEdit(user)}
                                                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                                                >
                                                    <Key size={13} /> Gérer les permissions
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {users.length === 0 && (
                            <div className="py-12 text-center text-muted-foreground border border-dashed border-border/60 rounded-2xl bg-surface/20">
                                <Shield size={36} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm font-medium">Aucun sous-utilisateur configuré.</p>
                                <p className="text-xs text-muted-foreground mt-1">Créez votre premier membre pour limiter ses accès au serveur.</p>
                                {can('user.create') && (
                                    <Button onClick={handleOpenAdd} variant="primary" className="mt-4 gap-2 text-xs">
                                        <Plus size={16} /> Créer un utilisateur
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Sessions Tab */}
                {activeTab === 'sessions' && (
                    <div className="space-y-3">
                        {sessions.map((session) => {
                            const isMe = session.uuid === myUuid;
                            const connectDate = new Date(session.connectedAt);
                            const now = Date.now();
                            const uptimeMinutes = Math.floor((now - session.connectedAt) / 60000);
                            const isOnline = (now - session.lastSeen) < 120000;
                            
                            return (
                                <div 
                                    key={session.uuid} 
                                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border ${
                                        isMe ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-surface/30'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                                            isMe ? 'bg-primary/10 text-primary shadow-sm' : 'bg-surface-hover/50 text-muted-foreground'
                                        }`}>
                                            {session.avatar ? (
                                                <img src={session.avatar} alt={session.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <User size={18} />
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-foreground tracking-tight">{session.name}</span>
                                                {isMe && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-1.5 py-0.5 rounded bg-primary/10">
                                                        (Vous)
                                                    </span>
                                                )}
                                                <div className="flex items-center gap-1.5 ml-1">
                                                    {isOnline ? (
                                                        <span className="text-xs font-medium text-success/90">En ligne</span>
                                                    ) : (
                                                        <span className="text-xs font-medium text-muted-foreground/70">Hors ligne</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center flex-wrap gap-1.5 mt-1">
                                                <span>{(session.ip || '').includes(':') ? 'IPv6' : 'IPv4'} {session.ip || 'Inconnu'}</span>
                                                <span className="opacity-40">•</span>
                                                <span>{session.location || 'Localisation inconnue'}</span>
                                                <span className="opacity-40">•</span>
                                                <span>{session.os || 'OS Inconnu'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center mt-4 sm:mt-0 pl-14 sm:pl-0">
                                        <div className="flex flex-col sm:items-end text-sm text-muted-foreground">
                                            <span className="font-medium text-xs">
                                                {isOnline ? `Session : ${formatUptime(uptimeMinutes)}` : 'Inactif'}
                                            </span>
                                            <span className="text-[11px] opacity-70">
                                                {isOnline 
                                                    ? `Connecté à ${connectDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                                                    : `Vu le ${new Date(session.lastSeen).toLocaleDateString()} à ${new Date(session.lastSeen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* User Permission Modal */}
            <UserPermissionModal
                isOpen={modalOpen}
                userToEdit={editingUser}
                onClose={() => setModalOpen(false)}
                onSave={saveUser}
                onDelete={deleteUser}
            />
        </div>
    );
};
