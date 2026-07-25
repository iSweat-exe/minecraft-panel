# API Reference - Minecraft Panel Daemon

Cette documentation décrit l'API REST v1 du daemon. Toutes les requêtes (sauf exception) doivent inclure un token JWT valide dans le header `Authorization`.

## Informations Générales

- **Base URL**: `http://<IP>:<PORT>/api/v1`
- **Authentification**: Bearer Token (JWT).
- **Rate Limit**: 1000 requêtes par minute par adresse IP. Au-delà, l'API renvoie le code `429 Too Many Requests`.

## Format de Réponse Standard

La majorité des endpoints répondent avec le format JSON unifié suivant (`ApiResponse<T>`) :

```json
{
  "success": true,
  "data": { ... }, 
  "error": null
}
```
Si `success` est `false`, `error` contiendra le message d'erreur.

---

## Authentification

### `POST /auth/login`
Génère un token JWT.
- **Body** : `{"username": "votre_pseudo", "password": "votre_mot_de_passe"}`
- **Réponse** : `{"token": "eyJhb..."}`

---

## Serveurs (`/servers`)

### `GET /servers`
Liste tous les serveurs de jeu gérés par le daemon.

### `POST /servers`
Crée un nouveau serveur.

### `GET /servers/{id}/inspect`
Retourne les statistiques, l'état Docker, et les informations du serveur.

### `POST /servers/{id}/power`
Modifie l'état de l'alimentation du serveur.
- **Body** : `{"action": "start" | "stop" | "restart" | "kill"}`

### `POST /servers/{id}/command`
Envoie une commande à la console du serveur.
- **Body** : `{"command": "say Bonjour"}`

### `GET /servers/{id}/ws`
Endpoint WebSocket pour streamer la console en temps réel.

---

## Fichiers (`/files`)

### `GET /files/list?path=/dossier`
Liste les fichiers d'un dossier spécifique dans le contexte d'un serveur.

### `GET /files/read?path=/fichier.txt`
Lit le contenu d'un fichier.

### `POST /files/write`
Écrit ou modifie un fichier.

### `POST /files/upload`
Upload un ou plusieurs fichiers (form-data).

---

## Utilisateurs (`/users`)

### `GET /users`
Liste tous les utilisateurs du panel.

### `POST /users`
Crée ou met à jour un utilisateur.
- **Body** : `{"username": "...", "password_hash": "...", "role": "admin", "permissions": ["*"]}`

### `DELETE /users/{username}`
Supprime un utilisateur (Le compte "iSweat" root ne peut pas être supprimé).

---

## Système et Docker (`/system`)

### `GET /system/info`
Obtient les informations générales du daemon et la version.

### `GET /system/host`
Obtient des informations profondes sur l'hôte VPS (OS, Kernel, Uptime).

### `GET /system/docker/containers`
Liste brute de tous les conteneurs Docker de la machine (même ceux non gérés).

### `POST /system/docker/prune`
Nettoie les images, réseaux et volumes Docker inutilisés.
