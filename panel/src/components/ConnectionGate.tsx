import React from 'react';
import { useConnectionGate } from '../hooks/useConnectionGate';
import { FileUp } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/Card';

export const ConnectionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
        sshStatus,
        host,
        setHost,
        port,
        setPort,
        username,
        setUsername,
        subUsername,
        setSubUsername,
        keyPath,
        setKeyPath,
        verifyingKey,
        connect,
        pickKeyFile,
        dismissKeyVerification,
        acceptFingerprint,
        loginMode,
        setLoginMode,
        password,
        setPassword,
    } = useConnectionGate();

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
            <Card className="w-96 mx-4">
                <CardHeader className="pb-3">
                    <div className="flex bg-surface border border-border rounded-lg p-0.5 text-xs font-mono mb-2">
                        <button
                            onClick={() => setLoginMode('admin')}
                            className={`flex-1 py-1.5 rounded-md transition-all font-semibold ${
                                loginMode === 'admin' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Admin (Clé SSH)
                        </button>
                        <button
                            onClick={() => setLoginMode('subuser')}
                            className={`flex-1 py-1.5 rounded-md transition-all font-semibold ${
                                loginMode === 'subuser' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Sous-utilisateur
                        </button>
                    </div>
                    <CardTitle className="text-xs text-muted-foreground tracking-wider uppercase">
                        {loginMode === 'admin' ? 'Connexion Administrateur Root' : 'Connexion Membre du Panel'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Label className="mb-1 block text-muted-foreground">Hôte / IP VPS</Label>
                            <Input 
                                value={host} 
                                onChange={e => setHost(e.target.value)} 
                                placeholder="localhost ou IP"
                            />
                        </div>
                        <div className="w-24">
                            <Label className="mb-1 block text-muted-foreground">Port</Label>
                            <Input 
                                type="number"
                                value={port} 
                                onChange={e => setPort(parseInt(e.target.value) || 22)} 
                            />
                        </div>
                    </div>

                    {loginMode === 'admin' ? (
                        <>
                            <div>
                                <Label className="mb-1 block text-muted-foreground">Utilisateur (SSH)</Label>
                                <Input 
                                    value={username} 
                                    onChange={e => setUsername(e.target.value)} 
                                    placeholder="root"
                                />
                            </div>
                            <div>
                                <Label className="mb-1 block text-muted-foreground">Clé Privée SSH</Label>
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
                        </>
                    ) : (
                        <>
                            <div>
                                <Label className="mb-1 block text-muted-foreground">Pseudo Panel</Label>
                                <Input 
                                    value={subUsername} 
                                    onChange={e => setSubUsername(e.target.value)} 
                                    placeholder="ex: Adrien"
                                />
                            </div>
                            <div>
                                <Label className="mb-1 block text-muted-foreground">Mot de passe</Label>
                                <Input 
                                    type="password"
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    placeholder="Mot de passe"
                                />
                            </div>
                        </>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                    <Button 
                        variant="primary" 
                        className="w-full font-semibold"
                        onClick={() => connect()}
                        disabled={sshStatus === 'reconnecting'}
                    >
                        {sshStatus === 'reconnecting' ? 'Connexion en cours...' : 'Se connecter au Panel'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};
