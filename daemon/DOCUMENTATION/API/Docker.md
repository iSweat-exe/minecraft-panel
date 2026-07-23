# API: Système & Gestion Docker

Ces endpoints permettent de gérer l'instance Docker sous-jacente du serveur directement via l'API, sans passer par SSH.

Toutes ces routes se trouvent sous le préfixe : `/api/v1/system/docker`

Toutes les requêtes nécessitent une authentification via le header `Authorization: Bearer <TOKEN>`.

---

## 1. Conteneurs

### Lister les conteneurs
- **Méthode** : `GET`
- **Chemin** : `/containers`
- **Description** : Renvoie la liste de tous les conteneurs Docker (y compris ceux n'appartenant pas au panel).
- **Réponse** : Tableau d'objets `DockerContainerInfo`

### Exécuter une action sur un conteneur
- **Méthode** : `POST`
- **Chemin** : `/containers/:id/action`
- **Corps de la requête (JSON)** :
  ```json
  {
      "action": "start" // ou "stop", "restart", "remove"
  }
  ```
- **Réponse** : Status 200 (Success) avec message.

### Voir les logs bruts d'un conteneur
- **Méthode** : `GET`
- **Chemin** : `/containers/:id/logs`
- **Description** : Renvoie les logs récents d'un conteneur spécifique. Supporte la limite de lignes.

### Inspecter un conteneur
- **Méthode** : `GET`
- **Chemin** : `/containers/:id/inspect`
- **Description** : Renvoie le payload JSON brut de `docker inspect <id>`.

### Créer / Démarrer un nouveau conteneur
- **Méthode** : `POST`
- **Chemin** : `/containers`
- **Corps de la requête (JSON)** : Objet `DockerRunRequest` (image, nom, variables d'environnement, ports, restart_policy).
- **Réponse** : Status 200.

### Mettre à jour la configuration d'un conteneur
- **Méthode** : `PUT`
- **Chemin** : `/containers/:id`
- **Corps de la requête (JSON)** : Objet `DockerUpdateRequest` (nouveau nom, restart_policy). Ne recrée pas le conteneur.
- **Réponse** : Status 200.

### Recréer un conteneur avec de nouveaux paramètres
- **Méthode** : `POST`
- **Chemin** : `/containers/:id/recreate`
- **Corps de la requête (JSON)** : Objet `DockerRunRequest` (Similaire à la création).
- **Description** : Supprime le conteneur existant (force) et en relance un nouveau avec les paramètres fournis.
- **Réponse** : Status 200.

---

## 2. Images

### Lister les images Docker
- **Méthode** : `GET`
- **Chemin** : `/images`
- **Description** : Renvoie la liste de toutes les images téléchargées sur l'hôte.
- **Réponse** : Tableau d'objets `DockerImageInfo`.

### Pull (télécharger) une image
- **Méthode** : `POST`
- **Chemin** : `/images/pull`
- **Corps de la requête (JSON)** :
  ```json
  {
      "image_name": "nginx:latest"
  }
  ```
- **Réponse** : Status 200. Le téléchargement s'effectue de manière synchrone, la requête peut donc prendre du temps.

### Supprimer une image
- **Méthode** : `DELETE`
- **Chemin** : `/images/:id`
- **Description** : Force la suppression de l'image spécifiée.
- **Réponse** : Status 200.

---

## 3. Maintenance

### System Prune
- **Méthode** : `POST`
- **Chemin** : `/prune`
- **Description** : Supprime tous les conteneurs arrêtés, réseaux inutilisés, images orphelines, et volumes anonymes non utilisés (`docker system prune -af --volumes`).
- **Réponse** : Status 200 avec les détails du nettoyage.
