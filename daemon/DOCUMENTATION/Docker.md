# Implémentation Docker dans le Daemon

Ce document explique comment le Daemon gère et interagit avec Docker sous le capot. Il est utile pour comprendre l'architecture du nœud et comment les serveurs Minecraft sont conteneurisés.

## 1. La Librairie
Le Daemon utilise **[Bollard](https://crates.io/crates/bollard)**, un client Docker asynchrone 100% natif en Rust. Il communique directement avec le socket UNIX de Docker (`/var/run/docker.sock` sous Linux) ou via HTTP/TCP (Windows).

## 2. Reconnaissance des Conteneurs (Labels)
Pour éviter de supprimer ou de toucher à des conteneurs qui n'appartiennent pas au Panel (par exemple, si tu héberges un site web ou une base de données sur la même machine), le Daemon utilise un système de **Labels**.

Lors de la création d'un serveur, le Daemon attache les labels suivants au conteneur Docker :
- `mc-panel.managed=true` : Indique que ce conteneur appartient au panel.
- `mc-panel.server_id=<ID>` : L'identifiant unique du serveur.
- `mc-panel.name=<NOM>` : Le nom d'affichage du serveur.
- `mc-panel.owner=<PROPRIÉTAIRE>` (Optionnel).

**Réconciliation au démarrage :**
Quand le Daemon démarre, il interroge Docker pour lister *uniquement* les conteneurs ayant le label `mc-panel.managed=true`. Cela lui permet de reconstruire sa liste de serveurs en mémoire en une fraction de seconde, sans dépendre d'une base de données locale !

## 3. Configuration des Conteneurs (Création)
Lorsque la route `POST /api/v1/servers` est appelée, le Daemon crée le conteneur avec des paramètres de sécurité et d'isolation précis :

- **Ressources** : La RAM (`memory`) et le CPU (`cpu_quota` / `cpu_period`) sont limités fermement. Si le serveur Minecraft dépasse sa RAM, Docker le kill (OOM).
- **Redémarrage** : La politique de redémarrage est configurée sur `unless-stopped`. Si le serveur crash, Docker le relance automatiquement (sauf si tu as explicitement cliqué sur "Stop" dans le panel).
- **Sécurité** : Les profils AppArmor et Seccomp sont en `unconfined` pour certains vieux serveurs Java, et le conteneur est lancé en mode `privileged` (pour faciliter certaines manipulations de fichiers, bien que cela puisse être restreint à l'avenir).
- **Stdin/Stdout** : Le conteneur est créé avec un terminal virtuel (`tty=true`) et les flux ouverts (`open_stdin=true`). C'est ce qui permet au Daemon d'envoyer des commandes (via `POST /command`) comme si on tapait dans la console.

## 4. Accès aux Fichiers (Volumes)
Le Daemon ne stocke pas les fichiers directement dans l'image Docker (car sinon ils seraient effacés au redémarrage). Il utilise des **Bind Mounts**.
- Un dossier physique sur ta machine (ex: `/var/lib/volumes/abcd/`) est lié (`bind`) au dossier `/data` (ou `/home/container`) à l'intérieur du conteneur.
- Le gestionnaire de fichiers de l'API (routes `/api/v1/files/*`) modifie directement le dossier physique sur la machine hôte.

## 5. Streaming de la Console (WebSocket)
Lorsque tu ouvres la console sur le panel, le Daemon s'attache aux flux `stdout` et `stderr` du conteneur via Bollard. 
- Il diffuse (broadcast) ensuite chaque nouvelle ligne lue à tous les utilisateurs connectés sur la WebSocket de ce serveur précis.
- Si le conteneur n'est pas allumé, le Daemon lit d'abord les logs statiques via l'API de Docker pour afficher l'historique avant de commencer le streaming en direct.
