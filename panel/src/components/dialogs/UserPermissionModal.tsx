import React, { useState, useEffect } from 'react';
import { PanelUser, PERMISSION_CATEGORIES } from '../../types/permissions';
import { X, Shield, Check, Trash2, KeyRound } from 'lucide-react';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';

interface UserPermissionModalProps {
    isOpen: boolean;
    userToEdit: PanelUser | null;
    onClose: () => void;
    onSave: (user: PanelUser) => Promise<void>;
    onDelete?: (username: string) => Promise<void>;
}

export const UserPermissionModal: React.FC<UserPermissionModalProps> = ({
    isOpen,
    userToEdit,
    onClose,
    onSave,
    onDelete
}) => {
    const [username, setUsername] = useState<string>('');
    const [displayName, setDisplayName] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [avatarBase64, setAvatarBase64] = useState<string>('');
    const [role, setRole] = useState<'admin' | 'subuser'>('subuser');
    const [permissions, setPermissions] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState<boolean>(false);
    const [deleting, setDeleting] = useState<boolean>(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        setPassword('');
        if (userToEdit) {
            setUsername(userToEdit.username);
            setDisplayName(userToEdit.display_name || '');
            setAvatarBase64(userToEdit.avatar_base64 || '');
            setRole(userToEdit.role);
            setPermissions(new Set(userToEdit.permissions));
        } else {
            setUsername('');
            setDisplayName('');
            setAvatarBase64('');
            setRole('subuser');
            setPermissions(new Set());
        }
    }, [userToEdit, isOpen]);

    if (!isOpen) return null;

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 128;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setAvatarBase64(dataUrl);
            };
            img.src = URL.createObjectURL(file);
        }
    };

    const togglePermission = (key: string) => {
        setPermissions(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const toggleCategory = (keys: string[]) => {
        const allSelected = keys.every(k => permissions.has(k));
        setPermissions(prev => {
            const next = new Set(prev);
            if (allSelected) {
                keys.forEach(k => next.delete(k));
            } else {
                keys.forEach(k => next.add(k));
            }
            return next;
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) return;

        setSaving(true);
        try {
            await onSave({
                username: username.trim(),
                display_name: displayName.trim() || undefined,
                role,
                permissions: role === 'admin' ? ['*'] : Array.from(permissions),
                created_at: userToEdit?.created_at || Date.now(),
                password: password.trim() || undefined,
                avatar_base64: avatarBase64 || undefined
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!userToEdit || !onDelete) return;
        setDeleting(true);
        try {
            await onDelete(userToEdit.username);
            onClose();
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                            <Shield size={22} />
                        </div>
                        <div>
                            <h3 className="font-bold text-foreground text-lg">
                                {userToEdit ? `Permissions de ${userToEdit.username}` : 'Ajouter un sous-utilisateur'}
                            </h3>
                            <p className="text-muted-foreground text-xs">
                                Configurer le rôle, l'avatar et les accès individuels sur le serveur
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    
                    {/* User Profile Info Header (Avatar + Username + DisplayName) */}
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-surface/40 border border-border/80">
                        <div 
                            className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/30 flex flex-col items-center justify-center cursor-pointer overflow-hidden shrink-0 relative group shadow-inner"
                            onClick={() => fileInputRef.current?.click()}
                            title="Cliquer pour choisir une photo de profil"
                        >
                            {avatarBase64 ? (
                                <img src={avatarBase64} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="font-bold text-lg text-primary uppercase">
                                    {(username || 'SU').substring(0, 2)}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-[10px] font-semibold">
                                <span>Changer</span>
                            </div>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleAvatarChange} 
                            accept="image/*" 
                            className="hidden" 
                        />
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                    Pseudo Panel (Identifiant)
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    disabled={!!userToEdit}
                                    placeholder="ex: Adrien"
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-60 font-mono"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                    Nom d'affichage (Optionnel)
                                </label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    placeholder="ex: Adrien [Modérateur]"
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Password & Role Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <KeyRound size={14} /> Mot de passe du compte
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder={userToEdit ? "Laisser vide si inchangé" : "Définir un mot de passe"}
                                className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                                required={!userToEdit}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Shield size={14} /> Rôle du membre
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRole('subuser')}
                                    className={`py-2.5 px-2 text-xs font-bold rounded-lg border transition-all ${
                                        role === 'subuser'
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-surface hover:bg-surface-hover border-border text-muted-foreground'
                                    }`}
                                >
                                    Sous-utilisateur
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole('admin')}
                                    className={`py-2.5 px-2 text-xs font-bold rounded-lg border transition-all ${
                                        role === 'admin'
                                            ? 'bg-emerald-500 text-white border-emerald-500'
                                            : 'bg-surface hover:bg-surface-hover border-border text-muted-foreground'
                                    }`}
                                >
                                    Admin (*)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Permissions Checkboxes */}
                    {role === 'subuser' ? (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Permissions spécifiques (Style Pterodactyl)
                                </label>
                                <span className="text-xs text-primary font-medium">
                                    {permissions.size} permission(s) sélectionnée(s)
                                </span>
                            </div>

                            <div className="space-y-4">
                                {PERMISSION_CATEGORIES.map(cat => {
                                    const catKeys = cat.permissions.map(p => p.key);
                                    const allSelected = catKeys.every(k => permissions.has(k));

                                    return (
                                        <div key={cat.name} className="bg-surface/30 border border-border rounded-xl p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="text-sm font-bold text-foreground">{cat.name}</h4>
                                                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCategory(catKeys)}
                                                    className="text-xs font-semibold text-primary hover:underline"
                                                >
                                                    {allSelected ? 'Tout décocher' : 'Tout cocher'}
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                                {cat.permissions.map(p => {
                                                    const isChecked = permissions.has(p.key);
                                                    return (
                                                        <label
                                                            key={p.key}
                                                            onClick={() => togglePermission(p.key)}
                                                            className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition-all ${
                                                                isChecked
                                                                    ? 'bg-primary/10 border-primary/50 text-foreground'
                                                                    : 'bg-background hover:bg-surface border-border/60 text-muted-foreground'
                                                            }`}
                                                        >
                                                            <Checkbox
                                                                checked={isChecked}
                                                                readOnly
                                                                className="mt-0.5 pointer-events-none"
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-foreground">{p.label}</span>
                                                                <span className="text-[10px] text-muted-foreground">{p.description}</span>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 leading-relaxed">
                            <strong>Accès Administrateur Complet :</strong> Les administrateurs ont toutes les autorisations sur le serveur et le panel (`*`).
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                        {userToEdit ? (
                            <Button
                                type="button"
                                onClick={handleDelete}
                                disabled={deleting}
                                variant="secondary"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-2 text-xs"
                            >
                                <Trash2 size={16} /> Supprimer le membre
                            </Button>
                        ) : <div />}

                        <div className="flex items-center gap-3">
                            <Button type="button" onClick={onClose} variant="secondary" className="text-xs">
                                Annuler
                            </Button>
                            <Button type="submit" disabled={saving} variant="primary" className="gap-2 text-xs">
                                <Check size={16} /> {saving ? 'Sauvegarde...' : 'Enregistrer les permissions'}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
