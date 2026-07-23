# API System

Toutes les routes de cette section concernent les informations globales du nœud (Daemon), du système hôte et des configurations globales.

**Authentification** : Toutes les requêtes nécessitent un header `Authorization: Bearer <TOKEN>`.

---

## 1. Informations de base

### `GET /api/v1/info`
Retourne les informations de base sur le nœud, les versions et l'état global.

**Réponse** (`SystemInfoResponse`) :
```json
{
  "success": true,
  "data": {
    "version": "0.1.10",
    "protocol_version": "1.0",
    "node_id": "node-1",
    "docker_version": "24.0.5",
    "total_servers": 10,
    "running_servers": 5,
    "uptime_seconds": 3600
  }
}
```

---

## 2. Métriques Système (Temps Réel)

### `GET /api/v1/metrics`
Retourne l'usage global des ressources de la machine (CPU, RAM, Disque, Réseau).

**Réponse** (`SystemMetricsResponse`) :
```json
{
  "success": true,
  "data": {
    "cpu_percent": 25.4,
    "memory_used_bytes": 1073741824,
    "memory_total_bytes": 8589934592,
    "disk_used_bytes": 50000000000,
    "disk_total_bytes": 250000000000,
    "network_rx_bytes": 150000,
    "network_tx_bytes": 200000
  }
}
```

### `GET /api/v1/system/memory`
Détail approfondi sur l'état de la mémoire RAM du système hôte.

**Réponse** (`SystemMemoryResponse`) :
```json
{
  "success": true,
  "data": {
    "total_memory_kb": 16384000,
    "used_memory_kb": 8192000,
    "free_memory_kb": 8192000
  }
}
```

---

## 3. Informations Hôte et Santé

### `GET /api/v1/system/host`
Retourne le détail matériel de la machine physique exécutant le Daemon.

**Réponse** (`SystemHostResponse`) :
```json
{
  "success": true,
  "data": {
    "os_name": "Ubuntu",
    "os_version": "22.04 LTS",
    "kernel_version": "5.15.0-generic",
    "cpu_model": "AMD Ryzen 9 5950X",
    "cpu_cores": 16,
    "cpu_freq_mhz": 3400,
    "disk_total_mb": 500000,
    "disk_free_mb": 250000
  }
}
```

### `GET /api/v1/system/health`
Bilan de santé rapide de la machine et du moteur Docker.

**Réponse** (`SystemHealthResponse`) :
```json
{
  "success": true,
  "data": {
    "docker_responsive": true,
    "disk_space_warning": false
  }
}
```

### `GET /api/v1/system/logs?lines=100`
Affiche les logs d'exécution récents du Daemon lui-même.

**Paramètres Query** :
- `lines` (Optionnel) : Nombre de lignes à récupérer (Défaut : 100).

**Réponse** (`ServerLogsResponse`) :
```json
{
  "success": true,
  "data": {
    "lines": [
      "2026-07-23T12:00:00Z INFO Starting daemon...",
      "2026-07-23T12:00:01Z INFO Docker manager initialized"
    ]
  }
}
```

---

## 4. Configuration Système

### `GET /api/v1/system/crontab`
Lit le contenu du crontab de l'utilisateur exécutant le Daemon.

**Réponse** (`SystemCrontabResponse`) :
```json
{
  "success": true,
  "data": {
    "content": "0 0 * * * /backup.sh"
  }
}
```

### `PUT /api/v1/system/crontab`
Met à jour le contenu du crontab de l'hôte.

**Body de la requête** (`SystemCrontabRequest`) :
```json
{
  "content": "0 0 * * * /backup.sh\n* * * * * echo 'Alive'"
}
```

**Réponse** :
```json
{
  "success": true,
  "data": "Crontab updated successfully"
}
```

### `GET /api/v1/system/docker-config`
Lit le fichier de configuration global de Docker (généralement `/etc/docker/daemon.json`).

**Réponse** (`SystemDockerConfigResponse`) :
```json
{
  "success": true,
  "data": {
    "content": "{ \"log-driver\": \"json-file\" }"
  }
}
```

### `PUT /api/v1/system/docker-config`
Met à jour le fichier `daemon.json` de Docker (Un redémarrage de Docker est souvent nécessaire pour appliquer).

**Body de la requête** (`SystemDockerConfigRequest`) :
```json
{
  "content": "{ \"log-driver\": \"local\" }"
}
```

**Réponse** :
```json
{
  "success": true,
  "data": "Docker config updated successfully"
}
```

---

## 5. Mise à Jour du Daemon

### `POST /api/v1/update`
Déclenche une mise à jour autonome du binaire du Daemon depuis une URL distante (Remplacement à chaud / Atomic Swap).

**Body de la requête** (`NodeUpdateRequest`) :
```json
{
  "download_url": "https://api.github.com/repos/.../releases/latest/daemon",
  "expected_sha256": "abcdef123..."
}
```

**Réponse** :
```json
{
  "success": true,
  "data": "Update successful, daemon will restart shortly."
}
```
