#!/usr/bin/env bash
# ==============================================================================
# Minecraft Panel - Script de préparation du serveur (VPS / Dédié)
# Exécuter en root : bash setup.sh [username_ssh]
# ==============================================================================

set -e

# Vérification des privilèges root
if [ "$(id -u)" -ne 0 ]; then
    echo "❌ Erreur : Ce script doit être exécuté en tant que root (sudo bash setup.sh)."
    exit 1
fi

SSH_USER="${1:-$SUDO_USER}"
SSH_USER="${SSH_USER:-root}"

echo "======================================================================"
echo " 🚀 Initialisation du serveur pour Minecraft Panel"
echo " 👤 Utilisateur SSH configuré : $SSH_USER"
echo "======================================================================"

# 1. Mise à jour du système & Dépendances
echo "📦 [1/5] Installation des paquets de base..."
apt-get update -qq
apt-get install -y -qq curl wget tar gzip ca-certificates gnupg lsb-release > /dev/null

# 2. Installation de Docker
if ! command -v docker &> /dev/null; then
    echo "🐳 [2/5] Installation de Docker Engine..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
else
    echo "🐳 [2/5] Docker est déjà installé."
fi

# 3. Ajout de l'utilisateur au groupe Docker (pour exécuter sans sudo)
if [ "$SSH_USER" != "root" ]; then
    echo "👤 [3/5] Ajout de $SSH_USER au groupe docker..."
    usermod -aG docker "$SSH_USER" 2>/dev/null || true
fi

# 4. Création des dossiers du Panel avec les bons droits
echo "📁 [4/5] Configuration des répertoires /minecraft..."
mkdir -p /minecraft
mkdir -p /minecraft/.panel_logs
mkdir -p /minecraft/.panel_sessions

# Attribution de la propriété à l'utilisateur SSH
if [ "$SSH_USER" != "root" ]; then
    chown -R "$SSH_USER:$SSH_USER" /minecraft
fi
chmod -R 775 /minecraft

# 5. Pré-téléchargement de l'image Docker Minecraft
echo "📥 [5/5] Téléchargement des images Docker (itzg/minecraft-server)..."
docker pull itzg/minecraft-server:java21
docker pull itzg/minecraft-server:java25

echo "======================================================================"
echo " ✅ Configuration terminée avec succès !"
echo " ⚙️ Le dossier /minecraft est prêt et l'utilisateur $SSH_USER a accès à Docker."
echo " 💡 Vous pouvez maintenant vous connecter depuis l'application Minecraft Panel."
echo "======================================================================"
