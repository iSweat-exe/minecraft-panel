import React from 'react';
import { useConnectionGate } from '../hooks/useConnectionGate';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/Card';
import { Badge } from './ui/Badge';

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
        acceptFingerprint
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
            <Card className="w-80 mx-4">
                <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">SSH Connection</CardTitle>
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
                    
                    <div>
                        <Label className="mb-1 block text-muted-foreground">Username</Label>
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
                                Browse
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
                    <Badge variant="outline" className="text-muted-foreground">
                        Status: {sshStatus}
                    </Badge>
                </CardFooter>
            </Card>
        </div>
    );
};
