#!/usr/bin/env bash
# ==============================================================================
# Minecraft Panel - Script de nettoyage du conteneur
# ==============================================================================

echo "🛑 Arrêt et suppression du conteneur minecraft-panel-server..."
docker stop minecraft-panel-server 2>/dev/null || true
docker rm minecraft-panel-server 2>/dev/null || true
echo "✅ Conteneur supprimé. Le dossier /minecraft à été conservé."
