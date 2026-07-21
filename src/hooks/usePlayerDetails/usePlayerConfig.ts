import { useState, useEffect } from 'react';
import { tauriBridge } from '../../lib/tauriBridge';

export interface PlayerConfig {
    rconEnabled: boolean;
    rconPort: number;
    rconPass: string;
    actualFilePath: string;
}

export function usePlayerConfig(playerUuid: string) {
    const [config, setConfig] = useState<PlayerConfig | null>(null);

    useEffect(() => {
        let isMounted = true;

        const initConfig = async () => {
            let levelName = 'world';
            let rconEnabled = false;
            let rconPort = 25575;
            let rconPass = "";

            try {
                const props = await tauriBridge.sftpReadFile('/minecraft/server.properties');
                const match = props.match(/^level-name=(.*)$/m);
                if (match && match[1]) {
                    levelName = match[1].trim();
                }
                const rconEnableMatch = props.match(/^enable-rcon=(.*)$/m);
                if (rconEnableMatch && rconEnableMatch[1].trim() === 'true') {
                    rconEnabled = true;
                }
                const rconPortMatch = props.match(/^rcon\.port=(.*)$/m);
                if (rconPortMatch) {
                    rconPort = parseInt(rconPortMatch[1].trim(), 10);
                }
                const rconPassMatch = props.match(/^rcon\.password=(.*)$/m);
                if (rconPassMatch) {
                    rconPass = rconPassMatch[1].trim();
                }
            } catch (e) {
                // Ignore error
            }

            const possibleDirs = [
                `/minecraft/${levelName}/playerdata`,
                `/minecraft/${levelName}/players/data`
            ];

            let actualFilePath = "";
            
            for (const dir of possibleDirs) {
                try {
                    const files = await tauriBridge.sftpListDir(dir);
                    const flatUuid = playerUuid.replace(/-/g, '').toLowerCase();
                    const matchedFile = files.find(f => f.name.toLowerCase().replace(/-/g, '') === `${flatUuid}.dat`);
                    
                    const fileName = matchedFile ? matchedFile.name : `${playerUuid}.dat`;
                    actualFilePath = `${dir}/${fileName}`;
                    break;
                } catch (e) {
                }
            }

            if (!actualFilePath) {
                actualFilePath = `/minecraft/${levelName}/playerdata/${playerUuid}.dat`;
            }

            if (isMounted) {
                setConfig({ rconEnabled, rconPort, rconPass, actualFilePath });
            }
        };

        initConfig();

        return () => {
            isMounted = false;
        };
    }, [playerUuid]);

    return config;
}
