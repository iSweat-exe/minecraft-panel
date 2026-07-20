import { useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useToastStore } from '../store/toastStore';

export function useAutoUpdater() {
    const addToast = useToastStore((state) => state.addToast);

    useEffect(() => {
        const checkForUpdates = async () => {
            if (import.meta.env.DEV) return;
            
            try {
                const update = await check();
                if (update) {
                    addToast({ type: 'info', message: `Mise à jour ${update.version} disponible. Téléchargement en cours...` });
                    
                    await update.downloadAndInstall((event) => {
                        if (event.event === 'Finished') {
                            addToast({ type: 'success', message: 'Mise à jour terminée. Redémarrage...' });
                        }
                    });

                    await relaunch();
                }
            } catch (error) {
                console.error('Erreur lors de la vérification des mises à jour:', error);
            }
        };

        checkForUpdates();
    }, [addToast]);
}
