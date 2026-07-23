import React from 'react';
import { useConnectionGate } from '../hooks/useConnectionGate';
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
        subUsername,
        setSubUsername,
        connect,
        loginMode,
        setLoginMode,
        password,
        setPassword,
    } = useConnectionGate();

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
                            Administrateur
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
                        {loginMode === 'admin' ? 'Connexion Daemon (Admin)' : 'Connexion Membre du Panel'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Label className="mb-1 block text-muted-foreground">Hôte / IP Daemon</Label>
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
                                onChange={e => setPort(parseInt(e.target.value) || 8080)} 
                            />
                        </div>
                    </div>

                    {loginMode === 'admin' ? (
                        <>
                            <div>
                                <Label className="mb-1 block text-muted-foreground">Token Node (Mot de passe)</Label>
                                <Input 
                                    type="password"
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    placeholder="Daemon Token"
                                />
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
