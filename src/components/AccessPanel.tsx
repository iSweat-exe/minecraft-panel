import React from 'react';
import { useSessions } from '../hooks/useSessions';
import { User, ShieldCheck } from 'lucide-react';
import { Card } from './ui/Card';

export const AccessPanel: React.FC = () => {
    const { sessions } = useSessions();
    const myUuid = localStorage.getItem('panel_session_uuid');

    return (
        <Card className="flex flex-col h-full bg-background/50 p-6 border-border/50 shadow-none">
            <div className="mb-8">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck className="text-primary" />
                    Accès & Sessions
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Surveillez en temps réel les utilisateurs connectés au panel.
                </p>
            </div>
            
            <div className="space-y-3">
                {sessions.map((session) => {
                    const isMe = session.uuid === myUuid;
                    const connectDate = new Date(session.connectedAt);
                    const now = Date.now();
                    const uptimeMinutes = Math.floor((now - session.connectedAt) / 60000);
                    
                    return (
                        <div 
                            key={session.uuid} 
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border ${
                                isMe ? 'border-primary/40' : 'border-border/40 bg-surface/20'
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
                                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                                                (Vous)
                                            </span>
                                        )}
                                        <div className="flex items-center gap-1.5 ml-1">
                                            <span className="text-xs font-medium text-success/90">En ligne</span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center flex-wrap gap-1.5 mt-1">
                                        <span>{(session.ip || '').includes(':') ? 'IPv6' : 'IPv4'} {session.ip || 'Inconnu'}</span>
                                        <span className="opacity-40">•</span>
                                        <span>{session.location || 'Localisation inconnue'}</span>
                                        <span className="opacity-40">•</span>
                                        <span>{session.os || 'OS Inconnu'}</span>
                                        
                                        {session.ipv6 && session.ipv6 !== session.ip && (
                                            <>
                                                <span className="opacity-40">•</span>
                                                <span>IPv6 {session.ipv6}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center mt-4 sm:mt-0 pl-14 sm:pl-0">
                                <div className="flex flex-col sm:items-end text-sm text-muted-foreground">
                                    <span className="font-medium">{uptimeMinutes > 0 ? `${uptimeMinutes}m` : '< 1m'}</span>
                                    <span className="text-xs opacity-70">{connectDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {sessions.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground border border-dashed border-border/50 rounded-xl bg-surface/20">
                        <User size={32} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Aucune session active détectée.</p>
                    </div>
                )}
            </div>
        </Card>
    );
};
