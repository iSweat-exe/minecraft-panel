import { useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useToastStore } from '../store/toastStore';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';

export function useAutoUpdater() {
    const addToast = useToastStore((state) => state.addToast);

    useEffect(() => {
        const checkForUpdates = async () => {
            if (import.meta.env.DEV) return;
            
            try {
                const update = await check();
                if (update) {
                    const confirm = await ConfirmDialog.call({
                        title: 'Mise à jour disponible',
                        message: `La version ${update.version} de Minecraft Panel est disponible. Voulez-vous la télécharger et l'installer maintenant ? L'application redémarrera automatiquement.`,
                        confirmText: 'Mettre à jour',
                        cancelText: 'Plus tard',
                        variant: 'primary'
                    });

                    if (confirm) {
                        addToast({ type: 'info', message: `Téléchargement de la mise à jour ${update.version}...` });
                        
                        await update.downloadAndInstall((event) => {
                            if (event.event === 'Finished') {
                                addToast({ type: 'success', message: 'Mise à jour terminée. Redémarrage...' });
                            }
                        });

                        await relaunch();
                    }
                }
            } catch (error) {
                console.error('Erreur lors de la vérification des mises à jour:', error);
            }
        };

        checkForUpdates();
    }, [addToast]);
}
