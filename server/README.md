# 🚀 Configuration du Serveur Linux (VPS / Dédié)

Ce dossier contient les scripts d'installation automatisée à exécuter une seule fois sur votre serveur Linux (Debian, Ubuntu, CentOS...) en tant que **root**.

## 📋 Commande d'installation rapide (1-click)

Connectez-vous à votre serveur VPS via SSH en tant que `root` et lancez :

```bash
bash <(curl -sSL https://raw.githubusercontent.com/iSweat-exe/minecraft-panel/master/server/setup.sh)
```

Ou si vous avez téléchargé les fichiers sur le VPS :

```bash
sudo bash server/setup.sh [nom_utilisateur_ssh]
```

---

## 🛠️ Ce que fait le script `setup.sh` :

1. **Installe Docker Engine** automatiquement s'il n'est pas présent.
2. **Ajoute votre utilisateur SSH** au groupe `docker` afin que le panel puisse piloter les conteneurs sans demander de mot de passe `sudo`.
3. **Crée l'arborescence de fichiers** `/minecraft/`, `/minecraft/.panel_logs/`, `/minecraft/.panel_sessions/` avec les permissions optimales (`775`).
4. **Pré-télécharge les images Docker** Minecraft (`itzg/minecraft-server:java21` et `java25`) pour un premier démarrage ultra rapide.

---

## 🗑️ Réinitialisation / Nettoyage

Pour supprimer le conteneur du serveur tout en conservant vos fichiers de jeu :

```bash
bash server/cleanup.sh
```
