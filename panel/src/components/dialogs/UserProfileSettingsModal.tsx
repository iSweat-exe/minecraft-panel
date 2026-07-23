import React, { useState, useEffect, useRef } from 'react';
import { usePermissionStore } from '../../store/permissionStore';
import { X, User, KeyRound, Check, Camera, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { logAction } from '../../lib/actionLogger';

interface UserProfileSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UserProfileSettingsModal: React.FC<UserProfileSettingsModalProps> = ({
    isOpen,
    onClose
}) => {
    const { currentUser, saveUser } = usePermissionStore();
    const isAdmin = currentUser?.role === 'admin';

    const [displayName, setDisplayName] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [avatarBase64, setAvatarBase64] = useState<string>('');
    const [saving, setSaving] = useState<boolean>(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setDisplayName(currentUser?.display_name || localStorage.getItem('panel_display_name') || '');
            setAvatarBase64(currentUser?.avatar_base64 || localStorage.getItem('panel_avatar_base64') || '');
            setPassword('');
        }
    }, [isOpen, currentUser]);

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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Save to localStorage for quick local access
            localStorage.setItem('panel_display_name', displayName.trim());
            localStorage.setItem('panel_avatar_base64', avatarBase64);

            // Update user in SQLite panel.db on VPS
            if (currentUser) {
                await saveUser({
                    ...currentUser,
                    display_name: displayName.trim() || undefined,
                    avatar_base64: avatarBase64 || undefined,
                    password: password.trim() || undefined
                });
            }

            await logAction('Modification du profil utilisateur');
            onClose();
        } catch (err: any) {
            console.error('Failed to save profile settings:', err);
            alert(`Erreur lors de la sauvegarde : ${err?.message || err}`);
        } finally {
            setSaving(false);
        }
    };

    const activeUsername = currentUser?.username || localStorage.getItem('panel_username') || 'utilisateur';

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-2xl w-full max-w-md flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                            <Sparkles size={22} />
                        </div>
                        <div>
                            <h3 className="font-bold text-foreground text-lg">Mon Profil & Paramètres</h3>
                            <p className="text-muted-foreground text-xs font-mono">@{activeUsername}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-all group" title="Fermer">
                        <X size={18} className="transition-transform duration-300 group-hover:rotate-180" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-5">
                    
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center justify-center space-y-2">
                        <div 
                            className="w-24 h-24 rounded-full bg-surface-hover border-2 border-primary/40 flex items-center justify-center cursor-pointer overflow-hidden relative group shadow-lg"
                            onClick={() => fileInputRef.current?.click()}
                            title="Changer la photo de profil"
                        >
                            {avatarBase64 ? (
                                <img src={avatarBase64} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="font-bold text-2xl text-primary uppercase">
                                    {activeUsername.substring(0, 2)}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white text-xs font-medium">
                                <Camera size={20} className="mb-1" />
                                <span>Modifier</span>
                            </div>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleAvatarChange} 
                            accept="image/*" 
                            className="hidden" 
                        />
                        <span className="text-[11px] text-muted-foreground">Cliquez sur l'avatar pour importer une image</span>
                    </div>

                    {/* Display Name Field */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <User size={14} /> Nom d'affichage
                        </label>
                        <Input
                            type="text"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            placeholder={activeUsername}
                        />
                    </div>

                    {/* Password Field (Only for Sub-Users) */}
                    {!isAdmin && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <KeyRound size={14} /> Nouveau mot de passe
                            </label>
                            <Input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Laisser vide si inchangé"
                            />
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                        <Button type="button" onClick={onClose} variant="secondary" className="text-xs">
                            Annuler
                        </Button>
                        <Button type="submit" disabled={saving} variant="primary" className="gap-2 text-xs font-semibold">
                            <Check size={16} /> {saving ? 'Sauvegarde...' : 'Enregistrer'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
