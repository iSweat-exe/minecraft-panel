import { useState, useCallback, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';

export interface WorldInfo {
    name: string;
    isActive: boolean;
}

export function useWorlds() {
    const { sshStatus } = useConnectionStore();
    const [worlds, setWorlds] = useState<WorldInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchWorlds = useCallback(async () => {
        if (sshStatus !== 'connected') return;
        setLoading(true);
        setError(null);
        try {
            // Read server.properties
            const output = await tauriBridge.sftpReadFile('/minecraft/server.properties').catch(() => "");
            let activeWorldName = 'world';
            const match = output.match(/^level-name=(.+)$/m);
            if (match) {
                activeWorldName = match[1].trim();
            }

            // 1. Find all world folders by checking for level.dat via SSH
            const findOutput = await tauriBridge.sshExecute('ls -d /minecraft/*/level.dat 2>/dev/null || true');
            const validWorlds = findOutput
                .split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => {
                    // /minecraft/worldName/level.dat -> worldName
                    const parts = line.split('/');
                    return parts[parts.length - 2];
                });

            // Ensure the active world is always in the list even if it failed to read (edge case)
            if (!validWorlds.includes(activeWorldName)) {
                validWorlds.push(activeWorldName);
            }

            setWorlds(validWorlds.map(name => ({
                name,
                isActive: name === activeWorldName
            })).sort((a, b) => a.name.localeCompare(b.name)));

        } catch (err: any) {
            console.error("Failed to fetch worlds:", err);
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }, [sshStatus]);

    const setActiveWorld = async (worldName: string) => {
        setLoading(true);
        setError(null);
        try {
            // Read server.properties
            const props = await tauriBridge.sftpReadFile('/minecraft/server.properties');
            const lines = props.split('\n');
            
            let found = false;
            const updatedLines = lines.map(line => {
                if (line.startsWith('level-name=')) {
                    found = true;
                    return `level-name=${worldName}`;
                }
                return line;
            });

            if (!found) {
                updatedLines.push(`level-name=${worldName}`);
            }

            // Save server.properties
            await tauriBridge.sftpWriteFile('/minecraft/server.properties', updatedLines.join('\n'));

            // Warn players and wait 5s
            await tauriBridge.consoleSendCommand('/say Le serveur va redémarrer pour changer de monde dans 5 secondes...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Restart server
            await tauriBridge.serviceAction('restart');

            // Refresh list
            await fetchWorlds();

        } catch (err: any) {
            console.error("Failed to set active world:", err);
            setError(err.toString());
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWorlds();
    }, [fetchWorlds]);

    return {
        worlds,
        loading,
        error,
        fetchWorlds,
        setActiveWorld
    };
}
