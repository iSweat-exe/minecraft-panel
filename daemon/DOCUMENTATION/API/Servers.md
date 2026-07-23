# API Servers

Ces routes gèrent le cycle de vie et l'interaction avec les conteneurs de serveurs Minecraft hébergés par Docker.

**Authentification** : Toutes les requêtes nécessitent un header `Authorization: Bearer <TOKEN>`.

---

## 1. Cycle de Vie

### `GET /api/v1/servers`
Liste tous les serveurs actuellement gérés par le Daemon.

**Réponse** (`ServerListResponse`) :
```json
{
  "success": true,
  "data": {
    "servers": [
      {
        "server_id": "ab12cd34",
        "container_id": "893j4k...",
        "name": "mc-server-ab12cd34",
        "image": "itzg/minecraft-server",
        "state": "running",
        "memory_usage_bytes": 2147483648,
        "memory_limit_bytes": 4294967296,
        "cpu_percent": 15.2
      }
    ]
  }
}
```

### `POST /api/v1/servers`
Crée un nouveau serveur Minecraft sous forme de conteneur Docker.

**Body de la requête** (`ContainerSpec`) :
```json
{
  "server_id": "ab12cd34",
  "name": "Mon Super Serveur",
  "image": "itzg/minecraft-server",
  "env": ["EULA=TRUE", "TYPE=PAPER"],
  "ports": [
    {
      "host_port": 25565,
      "container_port": 25565,
      "protocol": "tcp"
    }
  ],
  "volumes": [
    {
      "host_path": "/var/lib/bolliard/volumes/ab12cd34",
      "container_path": "/data",
      "read_only": false
    }
  ],
  "resources": {
    "memory_limit_bytes": 4294967296,
    "cpu_quota": 200000,
    "cpu_period": 100000
  }
}
```

**Réponse** :
```json
{
  "success": true,
  "data": "1a2b3c4d5e6f..." // L'ID du conteneur créé
}
```

### `DELETE /api/v1/servers/{id}`
Arrête (si en cours d'exécution) et supprime définitivement le conteneur du serveur. *(Attention: Ne supprime pas les fichiers du volume).*

**Réponse** :
```json
{
  "success": true,
  "data": "Server container deleted"
}
```

---

## 2. Actions et Contrôles

### `POST /api/v1/servers/{id}/power`
Modifie l'état d'alimentation du serveur.

**Body de la requête** (`ServerPowerRequest`) :
```json
{
  "action": "start" // "start", "stop", "restart", ou "kill"
}
```

**Réponse** :
```json
{
  "success": true,
  "data": "Action completed"
}
```

### `POST /api/v1/servers/{id}/command`
Envoie une commande directement dans la console (Stdin) du serveur.

**Body de la requête** (`ServerCommandRequest`) :
```json
{
  "command": "say Hello World!"
}
```

**Réponse** :
```json
{
  "success": true,
  "data": "Command sent"
}
```

---

## 3. Diagnostics et Statistiques

### `GET /api/v1/servers/{id}/inspect`
Retourne le dump JSON complet et brut issu de la commande `docker inspect` du conteneur. Très utile pour des diagnostics avancés.

**Réponse** (`ContainerInspectResponse` issu de Bollard) :
```json
{
  "success": true,
  "data": {
    "Id": "...",
    "State": { ... },
    "HostConfig": { ... }
    // ...
  }
}
```

### `GET /api/v1/servers/{id}/ping`
Tente un Server List Ping (Minecraft natif) directement depuis le Daemon vers le conteneur.

**Réponse** (`MinecraftPingResponse`) :
```json
{
  "success": true,
  "data": {
    "online_players": 12,
    "max_players": 50,
    "motd": "Bienvenue sur le serveur",
    "version": "Paper 1.20.4"
  }
}
```

### `GET /api/v1/servers/{id}/crashes`
Liste les 5 derniers rapports de plantage détectés dans le dossier `crash-reports/` du serveur.

**Réponse** (`ServerCrashesResponse`) :
```json
{
  "success": true,
  "data": {
    "crash_reports": [
      "crash-2026-07-23_10.00.00-server.txt",
      "crash-2026-07-22_15.30.00-server.txt"
    ]
  }
}
```

### `GET /api/v1/servers/{id}/logs?lines=100`
Récupère les X dernières lignes affichées dans la console (stdout/stderr) du conteneur. Parfait pour initialiser l'affichage de la console sur le frontend.

**Paramètres Query** :
- `lines` (Optionnel) : Nombre de lignes (Défaut : 100)

**Réponse** (`ServerLogsResponse`) :
```json
{
  "success": true,
  "data": {
    "lines": [
      "[10:00:00] [Server thread/INFO]: Done (2.5s)! For help, type \"help\"",
      "[10:01:00] [Server thread/INFO]: Notch joined the game"
    ]
  }
}
```

---

## 4. Console Temps Réel (WebSocket)

### `GET /api/v1/servers/{id}/ws`
Endpoint pour initier une connexion WebSocket. Nécessite que le token JWT soit passé dans l'URL.

**URL de Connexion** :
`ws://<IP_DAEMON>/api/v1/servers/{id}/ws?token=<JWT>`

**Format des messages reçus (Serveur -> Client)** (`DaemonWsMessage`) :
```json
{
  "type": "ConsoleOutput",
  "line": "[10:00:00] [Server thread/INFO]: Notch joined the game"
}
```
Ou en cas de changement d'état :
```json
{
  "type": "StatusUpdate",
  "status": "running"
}
```

**Format des messages envoyés (Client -> Serveur)** (`ClientWsMessage`) :
```json
{
  "type": "Command",
  "command": "say Hello!"
}
```
