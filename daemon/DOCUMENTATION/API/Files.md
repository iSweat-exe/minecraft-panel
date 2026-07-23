# API Files

Ces routes permettent la gestion complète des fichiers des serveurs (lecture, écriture, déplacement, suppression) depuis l'interface web.

**Authentification** : Toutes les requêtes nécessitent un header `Authorization: Bearer <TOKEN>`.

> [!WARNING]
> Par sécurité, l'API du Daemon intègre une fonction `sanitize_path` qui bloque toutes les requêtes contenant des traversées de répertoires (`../`). Les chemins fournis par le Panel doivent être absolus par rapport au système (ex: `/var/lib/bolliard/volumes/abcd/...`).

---

## 1. Lecture et Navigation

### `GET /api/v1/files/list?path=<CHEMIN>`
Liste le contenu d'un répertoire. 

**Paramètres Query** :
- `path` : Le chemin absolu du dossier à lister.

**Réponse** (`FileListResponse`) :
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "name": "server.properties",
        "is_dir": false,
        "size": 1024,
        "modified_at": 1690123456,
        "mode": 33188
      },
      {
        "name": "plugins",
        "is_dir": true,
        "size": 4096,
        "modified_at": 1690123000,
        "mode": 16877
      }
    ]
  }
}
```

### `GET /api/v1/files/read?path=<CHEMIN>`
Télécharge ou lit le contenu d'un fichier.

**Paramètres Query** :
- `path` : Le chemin absolu du fichier.

**Réponse** :
La réponse HTTP brute contenant les bytes du fichier, avec le `Content-Type` approprié. Ce n'est **pas** un JSON `ApiResponse`.

### `GET /api/v1/files/hash?path=<CHEMIN>`
Génère le hash SHA-1 d'un fichier. Utile pour comparer les fichiers de configuration ou les mods et détecter les changements.

**Paramètres Query** :
- `path` : Le chemin absolu du fichier.

**Réponse** (`FileHashResponse`) :
```json
{
  "success": true,
  "data": {
    "sha1_hex": "e5c2b4c1070e..."
  }
}
```

---

## 2. Modification et Actions

### `POST /api/v1/files/write?path=<CHEMIN>`
Écrit du texte ou des bytes dans un fichier (Le crée s'il n'existe pas, ou l'écrase).

**Paramètres Query** :
- `path` : Le chemin absolu du fichier cible.

**Body de la requête** (`FileWriteRequest`) :
```json
{
  "content": "nouvelle ligne de configuration=true\n"
}
```

**Réponse** :
```json
{
  "success": true,
  "data": "File saved"
}
```

### `POST /api/v1/files/action`
Effectue une opération système (Créer un dossier, renommer, copier, ou supprimer).

**Body de la requête** (`FileActionRequest`) :
```json
{
  "action": "rename", // "create_dir", "delete", "rename", "copy"
  "target": "/var/lib/volumes/abcd/old_name.txt",
  "destination": "/var/lib/volumes/abcd/new_name.txt" // Nécessaire uniquement pour rename et copy
}
```

**Réponse** :
```json
{
  "success": true,
  "data": "Action completed"
}
```
