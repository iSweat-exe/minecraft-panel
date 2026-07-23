import { useState, useEffect } from 'react';
import { tauriBridge } from '../lib/tauriBridge';
import { logAction } from '../lib/actionLogger';

export interface ServerProps {
    'max-players': string;
    'gamemode': string;
    'difficulty': string;
    'white-list': string;
    'online-mode': string;
    'allow-flight': string;
    'force-gamemode': string;
    'spawn-protection': string;
    'require-resource-pack': string;
    'resource-pack': string;
    'resource-pack-prompt': string;
    [key: string]: string;
}

export function useServerOptions() {
    const [properties, setProperties] = useState<ServerProps | null>(null);
    const [originalContent, setOriginalContent] = useState<string>("");
    const [serverIcon, setServerIcon] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);

    const fetchProperties = async () => {
        setLoading(true);
        try {
            const content = await tauriBridge.sftpReadFile('/minecraft/server.properties');
            setOriginalContent(content);
            const lines = content.split('\n');
            const props: any = {};
            for (const line of lines) {
                if (line.trim().startsWith('#') || line.trim() === '') continue;
                const [key, ...rest] = line.split('=');
                if (key) {
                    props[key.trim()] = rest.join('=').trim();
                }
            }
            setProperties(props);
        } catch (error) {
            console.error("Failed to load server.properties:", error);
        }

        try {
            const base64 = await tauriBridge.sftpReadFileBase64('/minecraft/server-icon.png');
            setServerIcon(`data:image/png;base64,${base64}`);
        } catch (error) {
            // Icon might not exist, silently ignore
            console.log("No server-icon.png found or failed to load");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProperties();
    }, []);

    const handleSave = async () => {
        if (!properties) return;
        setSaving(true);
        try {
            const lines = originalContent.split('\n');
            const updatedLines = lines.map(line => {
                if (line.trim().startsWith('#') || line.trim() === '') return line;
                const key = line.split('=')[0].trim();
                if (key && properties[key] !== undefined) {
                    return `${key}=${properties[key]}`;
                }
                return line;
            });
            
            // Add any missing core props just in case
            const existingKeys = updatedLines.map(l => l.split('=')[0].trim());
            for (const key of Object.keys(properties)) {
                if (!existingKeys.includes(key)) {
                    updatedLines.push(`${key}=${properties[key]}`);
                }
            }

            await tauriBridge.sftpWriteFile('/minecraft/server.properties', updatedLines.join('\n'));
            setOriginalContent(updatedLines.join('\n'));
            setSavedSuccess(true);
            setTimeout(() => setSavedSuccess(false), 2500);
            
            logAction('Modification des propriétés du serveur', { file: 'server.properties' });
            
            import('../store/toastStore').then(({ useToastStore }) => {
                useToastStore.getState().addToast({
                    type: 'success',
                    message: 'Paramètres sauvegardés',
                    description: 'Le fichier server.properties a été mis à jour.'
                });
            });
        } catch (error: any) {
            console.error("Failed to save server.properties:", error);
            import('../store/toastStore').then(({ useToastStore }) => {
                useToastStore.getState().addToast({
                    type: 'error',
                    message: 'Erreur lors de la sauvegarde',
                    description: error.toString()
                });
            });
        } finally {
            setSaving(false);
        }
    };

    const updateProp = (key: keyof ServerProps, value: string) => {
        setProperties(prev => prev ? { ...prev, [key]: value } : null);
    };

    return {
        properties,
        serverIcon,
        loading,
        saving,
        savedSuccess,
        updateProp,
        handleSave,
        fetchProperties
    };
}
