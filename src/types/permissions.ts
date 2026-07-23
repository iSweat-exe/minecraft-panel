export interface PanelUser {
    uuid?: string;
    username: string;
    role: 'admin' | 'subuser';
    permissions: string[];
    created_at?: number;
    password_hash?: string;
    password?: string;
    avatar_base64?: string;
    display_name?: string;
}

export interface PermissionDefinition {
    key: string;
    label: string;
    description: string;
}

export interface PermissionCategory {
    name: string;
    description: string;
    permissions: PermissionDefinition[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
    {
        name: 'Contrôle & Serveur',
        description: 'Gestion de l\'état de marche du serveur Minecraft',
        permissions: [
            { key: 'control.start', label: 'Démarrer', description: 'Allumer le serveur' },
            { key: 'control.stop', label: 'Arrêter', description: 'Éteindre le serveur' },
            { key: 'control.restart', label: 'Redémarrer', description: 'Redémarrer le serveur' }
        ]
    },
    {
        name: 'Console & RCON',
        description: 'Accès aux logs et envoi de commandes',
        permissions: [
            { key: 'console.view', label: 'Voir la console', description: 'Consulter les logs en direct' },
            { key: 'console.send', label: 'Envoyer des commandes', description: 'Exécuter des commandes RCON' }
        ]
    },
    {
        name: 'Fichiers & SFTP',
        description: 'Gestion des dossiers et fichiers du serveur',
        permissions: [
            { key: 'file.read', label: 'Lire les fichiers', description: 'Naviguer et afficher le contenu' },
            { key: 'file.write', label: 'Modifier les fichiers', description: 'Créer et éditer des fichiers' },
            { key: 'file.upload', label: 'Téléverser des fichiers', description: 'Uploader des fichiers sur le serveur' },
            { key: 'file.delete', label: 'Supprimer des fichiers', description: 'Supprimer des éléments' }
        ]
    },
    {
        name: 'Joueurs & Modération',
        description: 'Action sur les joueurs connectés et les statistiques',
        permissions: [
            { key: 'player.kick', label: 'Expulser (Kick)', description: 'Expulser des joueurs' },
            { key: 'player.ban', label: 'Bannir / Pardon', description: 'Bannir ou débannir des joueurs' },
            { key: 'player.op', label: 'Gérer les OP', description: 'Donner ou retirer le statut Opérateur' },
            { key: 'player.heal', label: 'Soin & Actions rapides', description: 'Soigner, nourrir et donner de l\'XP' }
        ]
    },
    {
        name: 'Sauvegardes & Backups',
        description: 'Gestion des sauvegardes du monde',
        permissions: [
            { key: 'backup.create', label: 'Créer une sauvegarde', description: 'Lancer une sauvegarde manuelles' },
            { key: 'backup.download', label: 'Télécharger', description: 'Récupérer les archives de sauvegarde' },
            { key: 'backup.restore', label: 'Restauration', description: 'Restaurer une ancienne sauvegarde' },
            { key: 'backup.delete', label: 'Suppression', description: 'Supprimer des sauvegardes' }
        ]
    },
    {
        name: 'Options & Version',
        description: 'Configuration du serveur et limites',
        permissions: [
            { key: 'settings.properties', label: 'server.properties', description: 'Modifier les options du serveur' },
            { key: 'settings.version', label: 'Changer la version', description: 'Modifier le moteur/version Java' },
            { key: 'settings.ram', label: 'Limites de RAM', description: 'Ajuster l\'allocation mémoire Docker' }
        ]
    },
    {
        name: 'Mondes & Mods',
        description: 'Changement de monde et installation de mods',
        permissions: [
            { key: 'world.change', label: 'Changer de monde', description: 'Activer un autre monde' },
            { key: 'mods.install', label: 'Installer des mods', description: 'Rechercher et installer des mods' }
        ]
    },
    {
        name: 'Gestion des Accès',
        description: 'Gestion des sous-utilisateurs du panel',
        permissions: [
            { key: 'user.create', label: 'Créer un sous-utilisateur', description: 'Inviter un membre' },
            { key: 'user.edit', label: 'Modifier les permissions', description: 'Ajuster les droits d\'un membre' },
            { key: 'user.delete', label: 'Supprimer un membre', description: 'Révoquer l\'accès d\'un membre' }
        ]
    }
];
