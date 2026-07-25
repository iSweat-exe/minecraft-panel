# ✅ Checklist de suivi — Audit minecraft-panel

> Coche les cases au fur et à mesure des corrections. Basé sur l'audit du 25/07/2026 (47 findings).
> Légende : 🔴 Critique · 🟠 Haute · 🟡 Moyenne · 🟢 Basse

## 🚨 Priorités immédiates (avant toute mise en prod)

- [x] **SEC-05** — Authentification manquante sur `/api/users`, `/api/sessions`, `/api/history`, `/api/automations`
- [x] **SEC-04** — `SessionAuth` utilise `node_token` au lieu de `jwt_secret` (auth.rs)
- [ ] **SEC-03** — Refuser le démarrage du daemon si secrets non configurés (config.rs)
- [ ] **SEC-01** — Endpoint `execute_command` : RCE via commande arbitraire (host.rs)
- [ ] **SEC-02** — PTY WebSocket : shell root interactif sans contrainte (pty.rs)
- [ ] **BUG-01** — `DROP TABLE sessions` exécuté à chaque démarrage (db.rs)
- [ ] **SEC-08** — Migrer le hash de mots de passe vers bcrypt/argon2 (commands/users.rs)

---

## 2. Failles de sécurité

### 🔴 Critique
- [ ] SEC-01 — RCE via `execute_command` (host.rs L49-94)
- [ ] SEC-02 — PTY WebSocket sans sandboxing (pty.rs L19-24)
- [ ] SEC-03 — Secrets/tokens en dur par défaut (config.rs L17-19)
- [x] SEC-04 — JWT signé avec `node_token` au lieu de `jwt_secret` (auth.rs L64-69)
- [x] SEC-05 — Routes users/sessions/history/automations sans auth

### 🟠 Haute
- [ ] SEC-06 — seccomp/AppArmor désactivés sur les conteneurs créés (docker.rs L136-142, 261-268)
- [ ] SEC-07 — `system_prune --volumes` supprime toutes les données (docker.rs L85-97)
- [ ] SEC-08 — Hash de mot de passe SHA-256 non salé (commands/users.rs L6-11)
- [ ] SEC-09 — Tokens stockés en clair dans `localStorage` (permissionStore.ts L24-27)
- [ ] SEC-10 — Permissions vérifiées uniquement côté frontend (permissionStore.ts L106-120)
- [ ] SEC-11 — Fallback réseau accorde les droits admin par défaut (permissionStore.ts L38-54)

### 🟡 Moyenne
- [ ] SEC-12 — CSP trop permissive (`unsafe-eval`, `http:`) (tauri.conf.json L22)
- [ ] SEC-13 — Communication daemon en HTTP non chiffré (permissionStore.ts, backupStore.ts)
- [ ] SEC-14 — Path traversal partiel dans `sanitize_path` (files/mod.rs L16-26)
- [ ] SEC-15 — `.unwrap()` sur le builder HTTP dans download.rs (L21-27)
- [ ] SEC-16 — Aucun rate limiting sur les routes

### 🟢 Basse
- [ ] SEC-17 — `password_hash` exposé dans les réponses `/api/users` (L67)
- [ ] SEC-18 — `can()` retourne `true` si `currentUser` est `null` (permissionStore.ts L108)
- [ ] SEC-19 — Utilisateur root "iSweat" créé sans mot de passe (db.rs L89-107)

---

## 3. Bugs

### 🔴 Critique
- [ ] BUG-01 — `DROP TABLE sessions` à chaque démarrage (db.rs L42-43)
- [ ] BUG-02 — `docker_version` codé en dur à "24.0" (info.rs L28)

### 🟠 Haute
- [ ] BUG-03 — `ConsoleStreamManager` réinstancié à chaque requête, jamais partagé (ws.rs, command.rs)
- [ ] BUG-04 — Paramètre `_tail` ignoré dans les logs de conteneur (commands/docker.rs L42)
- [ ] BUG-05 — `backups.rs` : `std::process::Command` bloquant en contexte async (L77-83)
- [ ] BUG-06 — `crontab.rs` : `std::process::Command` bloquant (L16-19, 47-50)
- [ ] BUG-07 — `update_docker_config` : `systemctl` bloquant (docker.rs L389-393)

### 🟡 Moyenne
- [ ] BUG-08 — Cast `online_players as u32` incorrect sur valeur négative (ping.rs L65-66)
- [ ] BUG-09 — `logs.rs` charge tout `daemon.log` en mémoire (L25-28)
- [ ] BUG-10 — `update_container` force un restart même sans changement nécessitant un redémarrage (docker.rs L243-250)
- [ ] BUG-11 — Erreur de `docker update` ignorée silencieusement (docker.rs L228-231)
- [ ] BUG-12 — Erreur de suppression ignorée dans `recreate_container` (docker.rs L259)
- [ ] BUG-13 — `ApiResponse` local dans backups.rs shadow le type protocole (L10-15)

### 🟢 Basse
- [ ] BUG-14 — `FileQuery` dupliqué dans 7 fichiers routes/files
- [ ] BUG-15 — `ProtocolVersionCheck` optionnel, ignorable (auth.rs L123-127)
- [ ] BUG-16 — Nouveau `reqwest::Client` créé à chaque commande Tauri (commands/node.rs)
- [ ] BUG-17 — Chemin `/backups/{server_id}` codé en dur (backups.rs L30)

---

## 4. Refactoring & Architecture

### 🟠 Haute
- [ ] REF-01 — Dédupliquer `node_client.rs` (~1100 lignes → méthode `request<T>()` générique)
- [ ] REF-02 — Extraire `build_docker_run_args()` commun à `run_container`/`recreate_container`

### 🟡 Moyenne
- [ ] REF-03 — Remplacer les 5 `ApiResponse` locaux par `protocol::ApiResponse`
- [ ] REF-04 — Créer un type `DaemonError` centralisé avec `IntoResponse`
- [ ] REF-05 — Remplacer `lazy_static` + `Mutex` std par `tokio::sync::Mutex` (metrics.rs)
- [ ] REF-06 — Séparer les DTOs `CreateUserRequest` (avec password) et `UserResponse` (sans)

### 🟢 Basse
- [ ] REF-07 — Vérifier les `permissions` du JWT côté daemon (pas seulement `server_id`) (ws.rs)
- [ ] REF-08 — Ajouter un audit log des actions sensibles côté daemon
- [ ] REF-09 — Limiter `DefaultBodyLimit::disable()` aux seules routes d'upload (mod.rs L31)
- [ ] REF-10 — Ajouter `.panel_users/`, `daemon.db`, `daemon.log`, `*.env` au `.gitignore`
- [ ] REF-11 — Ajouter des tests unitaires/intégration (aucun actuellement)

---

## 📊 Suivi global

| Catégorie | Total | Corrigés |
|---|---|---|
| Sécurité | 19 | ☐ |
| Bugs | 17 | ☐ |
| Refactoring | 11 | ☐ |
| **Total** | **47** | ☐ |