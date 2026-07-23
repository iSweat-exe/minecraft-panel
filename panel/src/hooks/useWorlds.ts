import { useState, useCallback, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { logAction } from '../lib/actionLogger';

export interface WorldInfo {
    name: string;
    isActive: boolean;
}

const DEFAULT_SERVER_ID = "minecraft-server";

export function useWorlds() {
    const [worlds, setWorlds] = useState<WorldInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getCredentials = () => {
        const host = localStorage.getItem('node_host');
        const port = localStorage.getItem('node_port') || '8080';
        const token = localStorage.getItem('node_token');
        if (!host || !token) throw new Error("Daemon credentials missing");
        return { nodeUrl: `http://${host}:${port}`, token };
    };

    const fetchWorlds = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { nodeUrl, token } = getCredentials();
            // Read server.properties
            const output = await tauriBridge.nodeReadFileText(nodeUrl, token, '/minecraft/server.properties').catch(() => "");
            let activeWorldName = 'world';
            const match = output.match(/^level-name=(.+)$/m);
            if (match) {
                activeWorldName = match[1].trim();
            }

            // 1. Find all world folders by checking for level.dat via Daemon
            const validWorlds: string[] = [];
            try {
                const dirList = await tauriBridge.nodeListDir(nodeUrl, token, '/minecraft');
                for (const item of dirList) {
                    if (item.is_dir) {
                        try {
                            const subDir = await tauriBridge.nodeListDir(nodeUrl, token, `/minecraft/${item.name}`);
                            if (subDir.some(f => f.name === 'level.dat')) {
                                validWorlds.push(item.name);
                            }
                        } catch (e) {}
                    }
                }
            } catch (e) {
                console.warn("Failed to list directories:", e);
            }

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
    }, []);

    const setActiveWorld = async (worldName: string) => {
        setLoading(true);
        setError(null);
        try {
            const { nodeUrl, token } = getCredentials();

            // Read server.properties
            const props = await tauriBridge.nodeReadFileText(nodeUrl, token, '/minecraft/server.properties');
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
            await tauriBridge.nodeWriteFile(nodeUrl, token, '/minecraft/server.properties', updatedLines.join('\n'));
            logAction('Changement du monde actif', { monde: worldName });

            // Warn players and wait 60s
            await tauriBridge.nodeSendCommand(nodeUrl, token, DEFAULT_SERVER_ID, 'say Le serveur va redémarrer pour changer de monde dans 60 secondes...').catch(() => {});
            await new Promise(resolve => setTimeout(resolve, 60000));

            // Restart server
            await tauriBridge.nodePowerAction(nodeUrl, token, DEFAULT_SERVER_ID, 'Restart');

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
