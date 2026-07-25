# 🔍 Audit Complet — minecraft-panel

> **Portée** : 100% des fichiers Rust (protocol, daemon, panel/src-tauri) + fichiers frontend clés (stores, tauriBridge, types).
> **Méthode** : Lecture exhaustive fichier par fichier, analyse statique manuelle, revue OWASP, revue architecture.

---

## Table des matières

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Failles de Sécurité](#2-failles-de-sécurité)
3. [Bugs](#3-bugs)
4. [Refactoring & Architecture](#4-refactoring--architecture)
5. [Index par fichier](#5-index-par-fichier)

---

## 1. Résumé Exécutif

| Catégorie | Critique | Haute | Moyenne | Basse | Total |
|---|---|---|---|---|---|
| **Sécurité** | 5 | 6 | 5 | 3 | **19** |
| **Bugs** | 2 | 5 | 6 | 4 | **17** |
| **Refactoring** | — | 2 | 4 | 5 | **11** |
| **Total** | **7** | **13** | **15** | **12** | **47** |

---

## 2. Failles de Sécurité

---

### SEC-01 · **CRITIQUE** · Exécution de commandes arbitraires sur l'hôte

> [!CAUTION]
> **RCE (Remote Code Execution)** — OWASP A03 Injection

| Champ | Valeur |
|---|---|
| **Fichier** | [host.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/host.rs#L49-L94) |
| **Lignes** | 49–94 |
| **Impact** | Un attaquant avec le `node_token` peut exécuter n'importe quelle commande système sur l'hôte (ex: `rm -rf /`, `curl ... \| bash`). |

**Code concerné** :
```rust
pub async fn execute_command(
    _auth: NodeAuth,
    Json(payload): Json<protocol::HostExecRequest>,
) -> ... {
    // payload.command is passed directly to sh/cmd
    let mut cmd = Command::new("cmd");
    cmd.args(["/C", &payload.command]);
```

**Problème** : `payload.command` provient d'une requête HTTP et est passé sans aucune validation ni restriction à un shell système. Même avec l'auth `NodeAuth`, c'est un point de RCE complet.

**Remédiation** :
- Implémenter une whitelist de commandes autorisées.
- Ou au minimum, interdire les caractères dangereux (`;`, `|`, `&&`, `$()`, backticks).
- Envisager de supprimer complètement cet endpoint si non strictement nécessaire.
- Ajouter une limitation de permissions (ne pas exécuter en tant que root).

---

### SEC-02 · **CRITIQUE** · PTY WebSocket = shell root interactif sans contrainte

> [!CAUTION]
> **RCE** — Shell interactif complet exposé via WebSocket

| Champ | Valeur |
|---|---|
| **Fichier** | [pty.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/pty.rs#L19-L24) |
| **Lignes** | 19–24 |
| **Impact** | Quiconque possède le `node_token` obtient un terminal interactif complet avec les privilèges du daemon. |

**Problème** : Le endpoint `/api/v1/system/host/pty` ouvre un pseudo-terminal (`portable_pty`) qui exécute bash ou powershell avec les privilèges du processus daemon. Aucune restriction de commande, aucun sandboxing.

**Remédiation** :
- Exécuter le PTY dans un conteneur isolé ou sous un utilisateur non-privilégié.
- Ajouter un audit log de toutes les entrées/sorties PTY.
- Envisager de le désactiver par défaut et de ne l'activer que via configuration explicite.

---

### SEC-03 · **CRITIQUE** · Secrets/tokens codés en dur dans le code source

> [!CAUTION]
> **OWASP A02** — Sensitive Data Exposure

| Champ | Valeur |
|---|---|
| **Fichier** | [config.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/config.rs#L17-L19) |
| **Lignes** | 17–19 |
| **Impact** | Les tokens par défaut sont des chaînes connues (`"secret-node-token-change-me"`, `"secret-jwt-key-change-me"`). Si les variables d'environnement ne sont pas définies, le daemon est totalement ouvert. |

**Code** :
```rust
node_token: "secret-node-token-change-me".to_string(),  //TODO: Github Secret
jwt_secret: "secret-jwt-key-change-me".to_string(),     //TODO: Github Secret
```

**Remédiation** :
- **Refuser de démarrer** si `DAEMON_NODE_TOKEN` et `DAEMON_JWT_SECRET` ne sont pas définis.
- Ne jamais fournir de valeur par défaut pour des secrets cryptographiques.
- Générer un secret aléatoire au premier démarrage et le persister dans un fichier de config.

---

### SEC-04 · **CRITIQUE** · JWT secret utilise `node_token` au lieu de `jwt_secret`

> [!CAUTION]
> **Défaut d'authentification** — Confusion de clé cryptographique

| Champ | Valeur |
|---|---|
| **Fichier** | [auth.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/auth.rs#L64-L69) |
| **Lignes** | 64–69 |
| **Impact** | Le `SessionAuth` utilise `config.node_token` comme clé de décodage JWT au lieu de `config.jwt_secret`. Toute personne connaissant le `node_token` peut forger des JWT valides. |

**Code** :
```rust
let jwt_secret = {
    let config = parts.extensions.get::<DaemonConfig>()...;
    config.node_token.clone()   // <--- BUG: devrait être config.jwt_secret
};
```

**Remédiation** :
```rust
config.jwt_secret.clone()
```

---

### SEC-05 · **CRITIQUE** · Routes `/api/users`, `/api/sessions`, `/api/history`, `/api/automations` sans authentification

> [!CAUTION]
> **OWASP A01** — Broken Access Control

| Champ | Valeur |
|---|---|
| **Fichiers** | [users.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/users.rs#L50), [sessions.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/sessions.rs#L50), [history.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/history.rs#L38), [automations.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/automations.rs#L50) |
| **Impact** | N'importe qui sur le réseau peut lire/modifier/supprimer des utilisateurs, des sessions, l'historique, et les automatisations **sans aucun token**. |

**Preuve** : Aucun de ces handlers n'a d'extracteur `NodeAuth` ou `SessionAuth` :
```rust
async fn list_users(State(state): State<AppState>) -> impl IntoResponse { ... }
async fn save_user(State(state): State<AppState>, ...) -> impl IntoResponse { ... }
async fn save_session(State(state): State<AppState>, ...) -> impl IntoResponse { ... }
async fn list_history(State(state): State<AppState>) -> impl IntoResponse { ... }
```

**Remédiation** : Ajouter `_auth: NodeAuth` à **tous** ces handlers.

---

### SEC-06 · **HAUTE** · Désactivation de seccomp et AppArmor sur les conteneurs créés

| Champ | Valeur |
|---|---|
| **Fichier** | [docker.rs (routes)](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/docker.rs#L136-L142) |
| **Lignes** | 136–142, 261–268 |
| **Impact** | Chaque conteneur créé via le panel a ses protections de sécurité kernel désactivées, facilitant les évasions de conteneur. |

**Code** :
```rust
let mut args = vec![
    "run", "-d",
    "--security-opt", "seccomp=unconfined",
    "--security-opt", "apparmor=unconfined",
];
```

**Remédiation** :
- Supprimer ces options par défaut.
- Si nécessaire pour certains serveurs Minecraft, les rendre optionnelles et documentées.

---

### SEC-07 · **HAUTE** · `system_prune` supprime TOUT y compris les volumes

| Champ | Valeur |
|---|---|
| **Fichier** | [docker.rs (routes)](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/docker.rs#L85-L97) |
| **Lignes** | 85–97 |
| **Impact** | L'option `--volumes` dans `docker system prune -af --volumes` supprime toutes les données persistées de tous les conteneurs sur l'hôte, pas seulement ceux du panel. |

**Remédiation** :
- Retirer `--volumes` par défaut.
- Ajouter un paramètre `include_volumes: bool` dans la requête pour contrôle explicite.

---

### SEC-08 · **HAUTE** · Hachage de mots de passe avec SHA-256 (non salé)

| Champ | Valeur |
|---|---|
| **Fichier** | [users.rs (panel)](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src-tauri/src/commands/users.rs#L6-L11) |
| **Lignes** | 6–11 |
| **Impact** | SHA-256 sans sel est trivial à cracker via rainbow tables ou brute force GPU. |

**Code** :
```rust
fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    ...
}
```

**Remédiation** :
- Utiliser **bcrypt**, **argon2**, ou **scrypt** avec un sel unique par utilisateur.
- Migrer les hashs existants lors de la prochaine connexion.

---

### SEC-09 · **HAUTE** · `node_token` et `jwt_secret` stockés en clair dans `localStorage`

| Champ | Valeur |
|---|---|
| **Fichier** | [permissionStore.ts](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src/store/permissionStore.ts#L24-L27) |
| **Lignes** | 24–27 (et partout dans les stores) |
| **Impact** | Les tokens de daemon sont stockés dans `localStorage`, accessible à tout JavaScript exécuté dans le contexte de l'app. |

**Code** :
```typescript
const token = localStorage.getItem('node_token');
const host = localStorage.getItem('node_host');
```

**Remédiation** :
- Utiliser `tauri-plugin-store` (déjà importé !) avec un store chiffré plutôt que `localStorage`.
- Ou stocker les tokens dans la mémoire Tauri backend (Rust state) plutôt que côté frontend.

---

### SEC-10 · **HAUTE** · Permission client-side bypassable

| Champ | Valeur |
|---|---|
| **Fichier** | [permissionStore.ts](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src/store/permissionStore.ts#L106-L120) |
| **Lignes** | 106–120 |
| **Impact** | Les permissions sont vérifiées **uniquement** côté frontend. Le daemon n'a aucun concept de sous-utilisateurs et autorise tout avec un `node_token` valide. Un sous-utilisateur peut directement appeler le daemon et contourner toutes les restrictions. |

**Remédiation** :
- Implémenter la vérification des permissions **côté daemon** (middleware axum).
- Utiliser les claims JWT pour transporter les permissions et les vérifier dans chaque handler.

---

### SEC-11 · **HAUTE** · Fallback dangereux — utilisateur non trouvé reçoit les droits admin

| Champ | Valeur |
|---|---|
| **Fichier** | [permissionStore.ts](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src/store/permissionStore.ts#L38-L44) |
| **Lignes** | 38–44, 48–54 |
| **Impact** | Si le fetch des utilisateurs échoue (erreur réseau, daemon redémarré…), le `currentUser` est créé avec `permissions: ['*']` si le mode n'est pas "subuser". Résultat : un erreur réseau donne les droits admin. |

**Code** :
```typescript
current = {
    username: storedUsername,
    role: isSubuserMode ? 'subuser' : 'admin',
    permissions: isSubuserMode ? [] : ['*']  // Admin par défaut !
};
```

**Remédiation** :
- En cas d'erreur réseau, **refuser l'accès** au lieu de donner les permissions maximales.
- Afficher un écran de connexion / erreur.

---

### SEC-12 · **MOYENNE** · CSP trop permissive

| Champ | Valeur |
|---|---|
| **Fichier** | [tauri.conf.json](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src-tauri/tauri.conf.json#L22) |
| **Ligne** | 22 |
| **Impact** | `script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:` autorise le chargement et l'exécution de scripts depuis n'importe quel domaine HTTP/HTTPS, rendant le CSP largement inefficace contre les XSS. |

**Remédiation** :
- Supprimer `'unsafe-eval'` et `http:` de `script-src`.
- Limiter `connect-src` aux domaines explicitement nécessaires.

---

### SEC-13 · **MOYENNE** · Communication daemon en HTTP (pas HTTPS)

| Champ | Valeur |
|---|---|
| **Fichier** | [permissionStore.ts](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src/store/permissionStore.ts#L28), [backupStore.ts](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src/store/backupStore.ts#L106) |
| **Impact** | Toutes les connexions panel→daemon utilisent `http://` en clair, exposant les tokens et données sensibles à l'interception réseau. |

**Remédiation** :
- Implémenter le support TLS dans le daemon (`axum-server` avec `rustls`).
- Ou au minimum, documenter que le daemon doit être derrière un reverse proxy HTTPS.

---

### SEC-14 · **MOYENNE** · Path traversal partiel dans `sanitize_path`

| Champ | Valeur |
|---|---|
| **Fichier** | [files/mod.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/files/mod.rs#L16-L26) |
| **Lignes** | 16–26 |
| **Impact** | La vérification bloque `../` mais pas les chemins absolus. Un chemin comme `/etc/shadow` passera la vérification. |

**Code** :
```rust
pub(crate) fn sanitize_path(path_str: &str) -> Result<PathBuf> {
    let path = PathBuf::from(path_str);
    if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        bail!("Path traversal is not allowed");
    }
    Ok(path)
}
```

**Remédiation** :
- Définir un répertoire racine autorisé (ex: `/var/lib/docker/volumes/...`).
- Vérifier que le chemin résolu (canonicalisé) est bien un enfant de ce répertoire.
- Refuser les chemins absolus commençant par `/`.

---

### SEC-15 · **MOYENNE** · `download.rs` — Panic possible via `.unwrap()` sur le builder HTTP

| Champ | Valeur |
|---|---|
| **Fichier** | [download.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/files/download.rs#L21-L27) |
| **Lignes** | 21–27 |
| **Impact** | Le double `.unwrap()` sur `Response::builder()...body(...).unwrap()` peut paniquer si un header invalide est injecté. |

**Remédiation** :
- Remplacer `.unwrap()` par `.unwrap_or_else(|e| ...)` ou utiliser `?`.

---

### SEC-16 · **MOYENNE** · Pas de rate limiting

| Champ | Valeur |
|---|---|
| **Fichier** | [mod.rs (routes)](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/mod.rs) |
| **Impact** | Aucun mécanisme de rate limiting. Un attaquant peut brute-forcer le `node_token` ou les mots de passe sans limite. |

**Remédiation** :
- Utiliser `tower-governor` ou un middleware custom pour limiter les requêtes par IP.

---

### SEC-17 · **BASSE** · Password hash exposé dans les réponses API `/api/users`

| Champ | Valeur |
|---|---|
| **Fichier** | [users.rs (daemon)](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/users.rs#L67) |
| **Ligne** | 67 |
| **Impact** | Le champ `password_hash` est retourné dans les réponses `list_users`. |

**Remédiation** :
- Exclure `password_hash` de la sérialisation via `#[serde(skip_serializing)]` ou un DTO de réponse dédié.

---

### SEC-18 · **BASSE** · `can()` retourne `true` si `currentUser` est `null`

| Champ | Valeur |
|---|---|
| **Fichier** | [permissionStore.ts](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src/store/permissionStore.ts#L108) |
| **Ligne** | 108 |
| **Impact** | Si l'utilisateur n'est pas chargé (`null`), toutes les vérifications de permission passent. |

**Code** :
```typescript
if (!currentUser) return true; // Default open if not logged in
```

---

### SEC-19 · **BASSE** · L'utilisateur root "iSweat" est créé sans mot de passe

| Champ | Valeur |
|---|---|
| **Fichier** | [db.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/db.rs#L89-L107) |
| **Lignes** | 89–107 |
| **Impact** | L'utilisateur admin auto-créé n'a pas de `password_hash`, ce qui peut poser problème si une authentification par mot de passe est requise. |

---

## 3. Bugs

---

### BUG-01 · **CRITIQUE** · `DROP TABLE sessions` exécuté à chaque démarrage

| Champ | Valeur |
|---|---|
| **Fichier** | [db.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/db.rs#L42-L43) |
| **Lignes** | 42–43 |
| **Impact** | Toutes les sessions actives sont **détruites** à chaque redémarrage du daemon. |

**Code** :
```sql
DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
```

**Remédiation** :
- Utiliser `CREATE TABLE IF NOT EXISTS sessions` comme pour les autres tables.

---

### BUG-02 · **CRITIQUE** · `docker_version` est codé en dur à `"24.0"`

| Champ | Valeur |
|---|---|
| **Fichier** | [info.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/info.rs#L28) |
| **Ligne** | 28 |
| **Impact** | L'information affichée dans le panel est toujours fausse. |

**Code** :
```rust
docker_version: "24.0".to_string(), // In a real app we could fetch this dynamically
```

**Remédiation** :
- Récupérer la version via `bollard::Docker::version()`.

---

### BUG-03 · **HAUTE** · `ConsoleStreamManager` instancié à chaque requête

| Champ | Valeur |
|---|---|
| **Fichiers** | [ws.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/servers/ws.rs#L40-L41), [command.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/servers/command.rs#L26-L27) |
| **Impact** | Chaque connexion WebSocket et chaque commande crée un **nouveau** `ConsoleStreamManager`, ce qui signifie que `send_command` dans `command.rs` ne retrouve jamais le stream actif créé par `ws.rs`. Le mécanisme de cache interne (`active_streams`) n'est jamais partagé entre les requêtes. |

**Remédiation** :
- Stocker un `ConsoleStreamManager` partagé dans `AppState` (via `Arc`).

---

### BUG-04 · **HAUTE** · `_tail` ignoré dans `node_docker_container_logs`

| Champ | Valeur |
|---|---|
| **Fichier** | [docker.rs (panel commands)](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src-tauri/src/commands/docker.rs#L42) |
| **Ligne** | 42 |
| **Impact** | Le paramètre `_tail: Option<u32>` est déclaré mais jamais utilisé. L'utilisateur ne peut pas contrôler le nombre de lignes retournées (toujours 150). |

---

### BUG-05 · **HAUTE** · `backups.rs` utilise `std::process::Command` (bloquant) dans un contexte async

| Champ | Valeur |
|---|---|
| **Fichier** | [backups.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/backups.rs#L77-L83) |
| **Lignes** | 77–83 |
| **Impact** | `StdCommand::new("tar")` bloque le thread du runtime Tokio pendant la compression. Avec un gros monde Minecraft, cela peut geler tout le daemon. |

**Remédiation** :
- Utiliser `tokio::process::Command` ou `tokio::task::spawn_blocking`.

---

### BUG-06 · **HAUTE** · `crontab.rs` utilise `std::process::Command` bloquant dans un handler async

| Champ | Valeur |
|---|---|
| **Fichier** | [crontab.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/crontab.rs#L16-L19) |
| **Lignes** | 16–19, 47–50 |
| **Impact** | Même problème que BUG-05 : `Command::new("crontab")` bloque le runtime async. |

---

### BUG-07 · **HAUTE** · `update_docker_config` utilise `std::process::Command` bloquant

| Champ | Valeur |
|---|---|
| **Fichier** | [docker.rs (routes)](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/docker.rs#L389-L393) |
| **Lignes** | 389–393 |
| **Impact** | `StdCommand::new("systemctl")` bloque le runtime Tokio. |

---

### BUG-08 · **MOYENNE** · `ping.rs` — casting potentiellement incorrect `online_players as u32`

| Champ | Valeur |
|---|---|
| **Fichier** | [ping.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/servers/ping.rs#L65-L66) |
| **Lignes** | 65–66 |
| **Impact** | `pong.online_players` est un `i32` dans `craftping`. Un cast `as u32` sur une valeur négative donne un nombre très élevé (ex: `-1 as u32` = `4294967295`). |

**Remédiation** :
- Utiliser `.try_into().unwrap_or(0)` ou `max(0) as u32`.

---

### BUG-09 · **MOYENNE** · `logs.rs` charge tout le fichier `daemon.log` en mémoire

| Champ | Valeur |
|---|---|
| **Fichier** | [system/logs.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/logs.rs#L25-L28) |
| **Lignes** | 25–28 |
| **Impact** | `tokio::fs::read_to_string("daemon.log")` charge l'intégralité du fichier en mémoire, puis ne retourne que les N dernières lignes. Si le log fait 500 Mo, le daemon va consommer 500 Mo de RAM pour retourner 100 lignes. |

**Remédiation** :
- Lire le fichier à l'envers (seek depuis la fin) pour ne charger que les lignes nécessaires.
- Ou utiliser la commande `tail -n`.

---

### BUG-10 · **MOYENNE** · `update_container` force un restart même si seul le nom change

| Champ | Valeur |
|---|---|
| **Fichier** | [docker.rs (routes)](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/docker.rs#L243-L250) |
| **Lignes** | 243–250 |
| **Impact** | Après `docker rename`, le code exécute **toujours** `docker restart`, même si aucun paramètre nécessitant un redémarrage n'a changé. |

---

### BUG-11 · **MOYENNE** · `update_container` ignore l'erreur du `docker update`

| Champ | Valeur |
|---|---|
| **Fichier** | [docker.rs (routes)](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/docker.rs#L228-L231) |
| **Lignes** | 228–231 |
| **Code** : `let _ = state.docker.run_docker_command(&update_args).await;` |
| **Impact** | Si `docker update` échoue (ex: mémoire invalide), l'erreur est silencieusement avalée et le conteneur est quand même redémarré. |

---

### BUG-12 · **MOYENNE** · `recreate_container` ignore l'erreur de suppression

| Champ | Valeur |
|---|---|
| **Fichier** | [docker.rs (routes)](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/docker.rs#L259) |
| **Ligne** | 259 |
| **Code** : `let _ = state.docker.run_docker_command(&["rm", "-f", &id]).await;` |
| **Impact** | Si la suppression échoue, le nouveau conteneur est quand même créé, potentiellement avec le même nom → erreur confuse. |

---

### BUG-13 · **MOYENNE** · `backups.rs` définit un `ApiResponse` local qui shadow `protocol::ApiResponse`

| Champ | Valeur |
|---|---|
| **Fichier** | [backups.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/backups.rs#L10-L15) |
| **Lignes** | 10–15 |
| **Impact** | Incohérence de format de réponse entre ce endpoint et tous les autres. Les clients du panel qui attendent le format `protocol::ApiResponse` auront potentiellement des désérialisations cassées (même si les champs sont identiques, c'est un smell architectural). |

---

### BUG-14 · **BASSE** · Duplication de `FileQuery` dans chaque fichier de routes/files

| Champ | Valeur |
|---|---|
| **Fichiers** | [list.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/files/list.rs#L8-L11), [read.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/files/read.rs#L10-L13), [write.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/files/write.rs#L8-L11), [action.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/files/action.rs#L8-L11), [download.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/files/download.rs#L10-L13), [upload.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/files/upload.rs#L7-L10), [hash.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/files/hash.rs#L8-L11) |
| **Impact** | 7 définitions identiques de `FileQuery { pub path: String }`. |

---

### BUG-15 · **BASSE** · `ProtocolVersionCheck` est optionnel (permet de l'ignorer)

| Champ | Valeur |
|---|---|
| **Fichier** | [auth.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/auth.rs#L123-L127) |
| **Lignes** | 123–127 |
| **Impact** | Si le header n'est pas présent, la vérification passe quand même (`Ok(ProtocolVersionCheck)`). Le commentaire dit "Optional" mais c'est probablement un oubli. |

---

### BUG-16 · **BASSE** · `DaemonClient` crée un nouveau `reqwest::Client` à chaque commande Tauri

| Champ | Valeur |
|---|---|
| **Fichier** | [node.rs (panel commands)](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src-tauri/src/commands/node.rs) |
| **Impact** | Chaque appel `node_get_info`, `node_list_servers`, etc. crée un nouveau `DaemonClient` avec un nouveau `reqwest::Client`. Les pools de connexions TCP ne sont jamais réutilisés. |

**Remédiation** :
- Stocker un `DaemonClient` dans le `tauri::State` et le réutiliser.

---

### BUG-17 · **BASSE** · `backups.rs::list_backups` suppose un chemin fixe `/backups/{server_id}`

| Champ | Valeur |
|---|---|
| **Fichier** | [backups.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/backups.rs#L30) |
| **Ligne** | 30 |
| **Impact** | Le chemin `/backups/` est codé en dur et ne sera pas trouvé sur Windows ou dans des configurations Docker non-standard. |

---

## 4. Refactoring & Architecture

---

### REF-01 · **HAUTE** · Code dupliqué massif dans `node_client.rs` (~1100 lignes)

| Champ | Valeur |
|---|---|
| **Fichier** | [node_client.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src-tauri/src/node_client.rs) |
| **Impact** | Chaque méthode répète le même pattern : build URL → set headers → send → check status → parse ApiResponse → extract data. ~30 méthodes quasi-identiques. |

**Remédiation** :
- Extraire une méthode privée `request<T>(&self, method, path, body) -> Result<T, AppError>`.
- Réduire le fichier de ~1100 à ~200 lignes.

---

### REF-02 · **HAUTE** · Code dupliqué entre `run_container` et `recreate_container`

| Champ | Valeur |
|---|---|
| **Fichier** | [docker.rs (routes)](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/docker.rs#L130-L194) vs [L253-L320](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/docker.rs#L253-L320) |
| **Impact** | 90% du code de construction des args Docker est copié-collé. |

**Remédiation** :
- Extraire une fonction `build_docker_run_args(payload: &DockerRunRequest) -> Vec<String>`.

---

### REF-03 · **MOYENNE** · 4 définitions locales de `ApiResponse` (shadow de `protocol::ApiResponse`)

| Champ | Valeur |
|---|---|
| **Fichiers** | [users.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/users.rs#L25-L30), [sessions.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/sessions.rs#L24-L29), [history.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/history.rs#L27-L32), [automations.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/automations.rs#L34-L39), [backups.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/backups.rs#L10-L15) |
| **Impact** | 5 structs `ApiResponse` identiques définies localement au lieu d'utiliser `protocol::ApiResponse`. Risque de désynchronisation du format JSON. |

---

### REF-04 · **MOYENNE** · Manque de mécanisme centralisé d'erreur HTTP

| Champ | Valeur |
|---|---|
| **Impact** | Chaque handler daemon fait son propre `match ... { Ok => ok, Err => err }`. Il n'y a pas d'`IntoResponse` implémenté sur un type d'erreur centralisé (comme c'est fait dans le panel avec `AppError`). |

**Remédiation** :
- Créer un type `DaemonError` avec `impl IntoResponse`.
- Utiliser `?` dans les handlers au lieu du pattern match répétitif.

---

### REF-05 · **MOYENNE** · `lazy_static` `Mutex` pour `sysinfo::System` dans `metrics.rs`

| Champ | Valeur |
|---|---|
| **Fichier** | metrics.rs (daemon) |
| **Impact** | L'utilisation de `lazy_static` avec `std::sync::Mutex` dans un contexte async peut bloquer le runtime Tokio si un lock est maintenu pendant un temps prolongé (et `sys.refresh_all()` peut prendre du temps). |

**Remédiation** :
- Utiliser `tokio::sync::Mutex` ou `tokio::task::spawn_blocking`.

---

### REF-06 · **MOYENNE** · `PanelUser.password` transité via le réseau

| Champ | Valeur |
|---|---|
| **Fichier** | [users.rs (daemon)](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/users.rs#L20) |
| **Impact** | Le champ `password: Option<String>` du DTO `PanelUser` est désérialisé depuis la requête HTTP. Même si la valeur est `None` en réponse, la structure accepte un mot de passe en clair dans la requête de sauvegarde. |

**Remédiation** :
- Séparer les DTOs de création (`CreateUserRequest` avec `password`) et de réponse (`UserResponse` sans `password` ni `password_hash`).

---

### REF-07 · **BASSE** · `DaemonClaims.permissions` n'est jamais vérifié côté daemon

| Champ | Valeur |
|---|---|
| **Fichier** | [ws.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/servers/ws.rs#L25-L31) |
| **Impact** | Le JWT contient des `permissions` (ex: `console:read`, `power:control`) mais seul `server_id` est vérifié dans le handler WebSocket. Les permissions sont ignorées. |

---

### REF-08 · **BASSE** · Pas de logging structuré des actions sensibles (daemon)

| Champ | Valeur |
|---|---|
| **Impact** | Les opérations destructives (suppression de serveur, modification Docker config, exécution de commandes hôte) ne sont pas loguées dans un audit trail côté daemon. |

---

### REF-09 · **BASSE** · `DefaultBodyLimit::disable()` appliqué globalement

| Champ | Valeur |
|---|---|
| **Fichier** | [mod.rs (routes)](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/mod.rs#L31) |
| **Ligne** | 31 |
| **Impact** | Permet l'upload de fichiers de taille illimitée, ouvrant à un DoS par remplissage de disque. |

**Remédiation** :
- Appliquer `DefaultBodyLimit` uniquement sur les routes d'upload, avec une taille raisonnable pour les autres.

---

### REF-10 · **BASSE** · Fichier `.gitignore` ne protège pas les fichiers sensibles

| Champ | Valeur |
|---|---|
| **Fichier** | [.gitignore](file:///c:/Users/iswea/Desktop/minecraft-panel/.gitignore) |
| **Impact** | Pas de règle pour exclure `.panel_users/`, `daemon.db`, `daemon.log`, `*.env`, ou les fichiers de configuration avec des secrets. |

---

### REF-11 · **BASSE** · Pas de tests unitaires ni d'intégration

| Champ | Valeur |
|---|---|
| **Impact** | Aucun fichier `#[cfg(test)]`, aucun répertoire `tests/`. Le projet n'a aucune couverture de test. |

---

## 5. Index par fichier

| Fichier | Findings |
|---|---|
| [config.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/config.rs) | SEC-03 |
| [auth.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/auth.rs) | SEC-04, BUG-15 |
| [db.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/db.rs) | BUG-01, SEC-19 |
| [files/mod.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/files/mod.rs) | SEC-14 |
| [routes/mod.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/mod.rs) | SEC-16, REF-09 |
| [routes/users.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/users.rs) | SEC-05, SEC-17, REF-03, REF-06 |
| [routes/sessions.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/sessions.rs) | SEC-05, REF-03 |
| [routes/history.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/history.rs) | SEC-05, REF-03 |
| [routes/automations.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/automations.rs) | SEC-05, REF-03 |
| [routes/system/host.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/host.rs) | SEC-01 |
| [routes/system/pty.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/pty.rs) | SEC-02 |
| [routes/system/docker.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/docker.rs) | SEC-06, SEC-07, BUG-05 (equiv), BUG-07, BUG-10, BUG-11, BUG-12, REF-02 |
| [routes/system/backups.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/backups.rs) | BUG-05, BUG-13, BUG-17, REF-03 |
| [routes/system/crontab.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/crontab.rs) | BUG-06 |
| [routes/system/info.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/info.rs) | BUG-02 |
| [routes/system/logs.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/system/logs.rs) | BUG-09 |
| [routes/files/download.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/files/download.rs) | SEC-15 |
| [routes/files/*.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/files) | BUG-14 |
| [routes/servers/ws.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/servers/ws.rs) | BUG-03, REF-07 |
| [routes/servers/command.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/servers/command.rs) | BUG-03 |
| [routes/servers/ping.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/daemon/src/routes/servers/ping.rs) | BUG-08 |
| [panel commands/users.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src-tauri/src/commands/users.rs) | SEC-08 |
| [panel commands/docker.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src-tauri/src/commands/docker.rs) | BUG-04 |
| [panel commands/node.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src-tauri/src/commands/node.rs) | BUG-16 |
| [node_client.rs](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src-tauri/src/node_client.rs) | REF-01 |
| [permissionStore.ts](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src/store/permissionStore.ts) | SEC-09, SEC-10, SEC-11, SEC-18 |
| [backupStore.ts](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src/store/backupStore.ts) | SEC-13 |
| [tauri.conf.json](file:///c:/Users/iswea/Desktop/minecraft-panel/panel/src-tauri/tauri.conf.json) | SEC-12 |
| [.gitignore](file:///c:/Users/iswea/Desktop/minecraft-panel/.gitignore) | REF-10 |
| Projet global | REF-04, REF-05, REF-08, REF-11 |

---

> [!IMPORTANT]
> **Priorités immédiates** (à corriger avant toute mise en production) :
> 1. **SEC-05** : Ajouter l'authentification sur `/api/users`, `/api/sessions`, `/api/history`, `/api/automations`
> 2. **SEC-04** : Corriger `config.node_token` → `config.jwt_secret` dans `SessionAuth`
> 3. **SEC-03** : Refuser le démarrage sans secrets configurés
> 4. **SEC-01/02** : Restreindre ou supprimer l'exécution de commandes hôte
> 5. **BUG-01** : Corriger le `DROP TABLE sessions`
> 6. **SEC-08** : Migrer vers bcrypt/argon2 pour le hachage des mots de passe
