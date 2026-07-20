import React from 'react';
import { useConnectionGate } from '../hooks/useConnectionGate';
import { FileUp } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/Card';
import { User } from 'lucide-react';

export const ConnectionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
        sshStatus,
        host,
        setHost,
        port,
        setPort,
        username,
        setUsername,
        keyPath,
        setKeyPath,
        verifyingKey,
        connect,
        pickKeyFile,
        dismissKeyVerification,
        acceptFingerprint,
        displayName,
        setDisplayName,
        avatarBase64,
        setAvatarBase64
    } = useConnectionGate();

    const fileInputRef = React.useRef<HTMLInputElement>(null);

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

    if (verifyingKey) {
        return (
            <div className="flex items-center justify-center h-full bg-background text-foreground">
                <Card className="max-w-md w-full mx-4">
                    <CardHeader>
                        <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Host Key Verification</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">The server presented this fingerprint:</p>
                        <div className="bg-background border border-border rounded-md p-3 font-mono text-xs text-foreground break-all mb-4">
                            {verifyingKey}
                        </div>
                        <p className="text-xs text-warning mb-5">
                            If you don't recognize this fingerprint, the connection may not be secure.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={dismissKeyVerification}>
                                Dismiss
                            </Button>
                            <Button variant="primary" className="flex-1" onClick={acceptFingerprint}>
                                Accept & Connect
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (sshStatus === 'connected') {
        return <>{children}</>;
    }

    return (
        <div className="flex items-center justify-center h-full bg-background text-foreground">
            <Card className="w-80 mx-4">
                <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground tracking-wider">SSH Connection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Label className="mb-1 block text-muted-foreground">Host</Label>
                            <Input 
                                value={host} 
                                onChange={e => setHost(e.target.value)} 
                                placeholder="localhost"
                            />
                        </div>
                        <div className="w-20">
                            <Label className="mb-1 block text-muted-foreground">Port</Label>
                            <Input 
                                type="number"
                                value={port} 
                                onChange={e => setPort(parseInt(e.target.value))} 
                            />
                        </div>
                    </div>
                    
                    <div className="flex gap-4 items-center">
                        <div 
                            className="w-16 h-16 rounded-full bg-surface-hover/50 flex flex-col items-center justify-center cursor-pointer border border-border border-dashed overflow-hidden shrink-0 relative group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {avatarBase64 ? (
                                <img src={avatarBase64} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <User size={24} className="text-muted-foreground" />
                            )}
                            <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-[10px] font-medium">Edit</span>
                            </div>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleAvatarChange} 
                            accept="image/*" 
                            className="hidden" 
                        />
                        <div className="flex-1">
                            <Label className="mb-1 block text-muted-foreground">Nom d'affichage (Display Name)</Label>
                            <Input 
                                value={displayName} 
                                onChange={e => setDisplayName(e.target.value)} 
                                placeholder="Ex: iSweat"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <Label className="mb-1 block text-muted-foreground">Username (SSH)</Label>
                        <Input 
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                        />
                    </div>
                    
                    <div>
                        <Label className="mb-1 block text-muted-foreground">Private Key</Label>
                        <div className="flex gap-2">
                            <Input 
                                className="flex-1" 
                                value={keyPath} 
                                onChange={e => setKeyPath(e.target.value)} 
                                placeholder="~/.ssh/id_ed25519"
                            />
                            <Button variant="secondary" onClick={pickKeyFile}>
                                <FileUp size={18} />
                            </Button>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                    <Button 
                        variant="primary" 
                        className="w-full"
                        onClick={() => connect()}
                        disabled={sshStatus === 'reconnecting'}
                    >
                        {sshStatus === 'reconnecting' ? 'Connecting...' : 'Connect'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};
