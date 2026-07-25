# Audit de Qualité & Maintenabilité — vps-panel daemon

**Date** : 2026-07-25  
**Stack** : Rust (edition 2021) — Axum 0.8, Bollard 0.18, SQLx 0.8 (SQLite), Tokio  
**Scope** : 100% des fichiers source du daemon  

---

## 1. Résumé Exécutif

| Type de problème | Élevé | Moyen | Faible | Total |
|---|---|---|---|---|
| Duplication de code | 3 | 2 | 0 | **5** |
| Complexité excessive | 1 | 1 | 0 | **2** |
| Séparation des responsabilités | 3 | 1 | 0 | **4** |
| Anti-pattern | 1 | 3 | 1 | **5** |
| Code mort | 0 | 1 | 1 | **2** |
| Gestion d'erreurs | 2 | 4 | 0 | **6** |
| Incohérence architecturale | 1 | 4 | 1 | **6** |
| Tests manquants | 1 | 0 | 0 | **1** |
| Performance | 0 | 2 | 1 | **3** |
| Dette technique | 1 | 2 | 0 | **3** |
| **Total** | **13** | **20** | **4** | **37** |

### État de santé général

Le code est **fonctionnel et globalement bien structuré** pour un projet de cette envergure. Les points forts sont : bonne utilisation de `thiserror`/`anyhow`, séparation claire en modules Docker/files/routes, API REST cohérente avec versioning v1, et une gestion de l'authentification multi-stratégie.

Les principaux axes de refactoring à prioriser sont :

1. **Duplication massive** du pattern `format!("mc-server-{}", server_id)` (12 occurrences), du pattern de vérification de permission (21 occurrences), et du boilerplate ApiResponse dans les routes.
2. **Double initialisation de la DB** dans `main.rs` (bug latent).
3. **Absence totale de tests** — aucun test unitaire ni d'intégration dans tout le projet.
4. **Incohérences architecturales** entre routes utilisant `DaemonError` vs retournant `Json<ApiResponse>` directement.

---

## 2. Tableau Récapitulatif

| ID | Fichier | Type | Impact | Description courte |
|---|---|---|---|---|
| REFACTO-001 | [main.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/main.rs#L57-L120) | Erreur / Dette | **Élevé** | Double appel à `db::init_db()` |
| REFACTO-002 | 12 fichiers | Duplication | **Élevé** | `format!("mc-server-{}", server_id)` dupliqué 12x |
| REFACTO-003 | 21 call sites | Duplication | **Élevé** | Pattern de vérification de permission dupliqué |
| REFACTO-004 | [main.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/main.rs#L68-L104) | Séparation resp. | **Élevé** | Logique de backfill inline dans main |
| REFACTO-005 | Toutes les routes | Incohérence | **Élevé** | Mix `DaemonError` vs `Json<ApiResponse>` |
| REFACTO-006 | Aucun fichier `tests/` | Tests | **Élevé** | Zéro tests dans le projet |
| REFACTO-007 | [update.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/update.rs) | Duplication | **Élevé** | Logique de swap binaire dupliquée 2x |
| REFACTO-008 | [auth.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/auth.rs#L139-L227) | Séparation resp. | **Élevé** | UserAuth fait requête DB dans un extractor |
| REFACTO-009 | [docker.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/system/docker.rs) | Séparation resp. | **Élevé** | Fichier de 433 lignes, ~13 handlers en un seul fichier |
| REFACTO-010 | [scheduler.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/scheduler.rs#L28-L30) | Anti-pattern | **Élevé** | Jobs d'automation ne font que loguer, pas d'exécution réelle |
| REFACTO-011 | [info.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/docker/info.rs#L128-L176) | Complexité | **Élevé** | `reconstruct_spec` imbrication 6 niveaux |
| REFACTO-012 | [create.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/create.rs#L52) | Gestion erreurs | **Élevé** | `if let Ok(...)` avale silencieusement l'erreur de sérialisation |
| REFACTO-013 | [delete.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/delete.rs#L27-L35) | Gestion erreurs | **Élevé** | `let _ =` sur suppression DB après delete Docker |
| REFACTO-014 | [auth_routes.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/auth_routes.rs#L32) | Gestion erreurs | **Moyen** | `hash_password` unwrap sur bcrypt::hash |
| REFACTO-015 | [metrics.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/metrics.rs#L19-L21) | Gestion erreurs | **Moyen** | 3x `.lock().unwrap()` sur Mutex |
| REFACTO-016 | [mod.rs (routes)](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/mod.rs#L44) | Gestion erreurs | **Moyen** | `state.lock().unwrap()` dans rate limiter |
| REFACTO-017 | [pty.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/system/pty.rs#L77-L78) | Gestion erreurs | **Moyen** | `.unwrap()` sur PTY reader/writer |
| REFACTO-018 | [ping.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/ping.rs#L26-L50) | Complexité | **Moyen** | Nesting 6+ niveaux pour extraire le port |
| REFACTO-019 | [patch.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/patch.rs) + [create.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/create.rs) | Duplication | **Moyen** | Logique de validation/allocation de ports dupliquée |
| REFACTO-020 | [automations.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/automations.rs) + [history.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/history.rs) + [sessions.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/sessions.rs) | Duplication | **Moyen** | Pattern CRUD identique — DbRow → Response mapping |
| REFACTO-021 | [backups.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/system/backups.rs#L58) | Incohérence | **Moyen** | Chemins hardcodés `/var/lib/docker/volumes/` |
| REFACTO-022 | [users.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/users.rs#L19) | Anti-pattern | **Moyen** | `password_hash` exposé dans la réponse API |
| REFACTO-023 | [host.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/system/host.rs) + [health.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/system/health.rs) + [memory.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/system/memory.rs) | Performance | **Moyen** | Création d'un `System::new()` à chaque requête |
| REFACTO-024 | [db.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/db.rs#L93-L106) | Incohérence | **Moyen** | Migrations manuelles avec `.ok()` |
| REFACTO-025 | [auth.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/auth.rs#L159) | Anti-pattern | **Moyen** | Détection JWT par `starts_with("ey")` |
| REFACTO-026 | [auth_routes.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/auth_routes.rs#L92) | Incohérence | **Moyen** | Messages d'erreur en français mélangés à l'anglais |
| REFACTO-027 | [files/action.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/files/action.rs#L44-L82) | Anti-pattern | **Moyen** | `std::process::Command` bloquant en contexte async |
| REFACTO-028 | [metrics.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/metrics.rs#L6-L14) | Performance | **Moyen** | `lazy_static!` + `Mutex` au lieu de `OnceLock` / `std::sync::LazyLock` |
| REFACTO-029 | [hash.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/files/hash.rs) | Performance | **Faible** | Lecture du fichier entier en mémoire pour le hashing |
| REFACTO-030 | [update.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/update.rs#L155-L157) | Dette technique | **Moyen** | TODO : asset CI/CD, code commenté |
| REFACTO-031 | [automations.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/automations.rs#L114) | Dette technique | **Moyen** | TODO : suppression dynamique du scheduler |
| REFACTO-032 | [auth.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/auth.rs#L105-L106) | Code mort | **Moyen** | `ProtocolVersionCheck` marqué `#[allow(dead_code)]` |
| REFACTO-033 | [info.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/docker/info.rs#L58) | Code mort | **Faible** | `get_server_status` marqué `#[allow(dead_code)]` |
| REFACTO-034 | [auth.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/auth.rs#L220-L227) | Séparation resp. | **Moyen** | Fallback silencieux vers "system" user |
| REFACTO-035 | [download.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/files/download.rs) | Anti-pattern | **Faible** | `.unwrap()` dans fallback de Response builder |
| REFACTO-036 | Multiples fichiers | Incohérence | **Faible** | Mix de `\r\n` et `\n` comme line endings |
| REFACTO-037 | [main.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/main.rs#L122-L124) | Dette technique | **Élevé** | Erreur du scheduler silencieusement avalée avec `eprintln!` |

---

## 3. Détail Complet par Type

---

### 3.1 — Duplication de Code

---

#### REFACTO-002 — Container name format dupliqué 12 fois

- **Fichiers** : [console.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/console.rs#L25), [console.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/console.rs#L56), [create.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/docker/create.rs#L56), [delete.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/docker/delete.rs#L9), [info.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/docker/info.rs#L60), [info.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/docker/info.rs#L100), [power.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/docker/power.rs#L12), [tty.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/docker/tty.rs#L8), [command.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/command.rs#L50), [crashes.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/crashes.rs#L15), [logs.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/logs.rs#L21), [ping.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/ping.rs#L13)
- **Type** : Duplication
- **Impact** : **Élevé** — Si le format du nom de container change (par ex. pour supporter des namespaces), il faudra modifier 12 fichiers. Source de bugs si une occurrence est oubliée.
- **Description** : Le pattern `format!("mc-server-{}", server_id)` est répété littéralement dans 12 emplacements distincts à travers le code.
- **Recommandation** : Extraire dans `DockerManager` :

  ```rust
  impl DockerManager {
      pub fn container_name(server_id: &str) -> String {
          format!("mc-server-{}", server_id)
      }
  }
  ```

---

#### REFACTO-003 — Pattern de vérification de permission dupliqué (21 occurrences)

- **Fichiers** : Tous les handlers dans `routes/v1/files/` et `routes/v1/system/docker.rs`
- **Type** : Duplication
- **Impact** : **Élevé** — Le même boilerplate de 3 lignes (`if let Err(…) = auth.require_permission(…) { return … }`) est copié-collé 21 fois. Certains handlers utilisent `DaemonError`, d'autres retournent `Json<ApiResponse>` directement — c'est incohérent et fragile.
- **Description** : Deux styles coexistent pour le même pattern :
  - **Style A** (fichiers routes) : `if let Err((_, msg)) = auth.require_permission("…") { return Json(ApiResponse::err(…)) }`
  - **Style B** (users, create, delete) : `auth.require_permission("…").map_err(|(_, msg)| DaemonError::Forbidden(…))?`
- **Recommandation** : Créer un middleware Axum de permission ou refactoriser `require_permission` pour retourner directement `Result<(), DaemonError>` :

  ```rust
  impl UserAuth {
      pub fn require(&self, perm: &str) -> Result<(), DaemonError> {
          if self.role == "admin" || self.permissions.contains(&"*".to_string()) {
              return Ok(());
          }
          if self.permissions.contains(&perm.to_string()) {
              return Ok(());
          }
          Err(DaemonError::Forbidden("You do not have permission…".into()))
      }
  }
  ```

---

#### REFACTO-007 — Logique de swap binaire dupliquée dans update.rs

- **Fichier** : [update.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/update.rs)
- **Lignes** : L92-L104 et L207-L217
- **Type** : Duplication
- **Impact** : **Élevé** — Les deux méthodes `apply_update` et `perform_cli_update` contiennent une logique quasi-identique de backup + rename atomique + rollback. Si la logique de swap change, il faut penser à modifier les deux.
- **Recommandation** : Extraire une fonction `atomic_binary_swap(new_binary: &Path) -> Result<()>` réutilisable.

---

#### REFACTO-019 — Validation/allocation de ports dupliquée

- **Fichiers** : [create.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/create.rs#L20-L49) et [patch.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/patch.rs#L48-L77)
- **Type** : Duplication
- **Impact** : **Moyen** — La boucle de vérification/insertion des ports dans `server_allocations` est copiée quasi-littéralement. Si la logique de validation de ports évolue, il faudra mettre à jour les deux fichiers.
- **Recommandation** : Extraire en fonction `allocate_ports(tx: &mut Transaction, server_id: &str, ports: &[PortMapping]) -> Result<()>`.

---

#### REFACTO-020 — Pattern CRUD identique entre automations, history, sessions

- **Fichiers** : [automations.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/automations.rs), [history.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/history.rs), [sessions.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/sessions.rs)
- **Type** : Duplication
- **Impact** : **Moyen** — Les 3 modules suivent exactement le même pattern : struct `Db…`, struct API, `list` handler qui fetch_all puis mappe champ par champ, `save` handler qui INSERT avec ON CONFLICT. La conversion row → struct est particulièrement verbeux.
- **Recommandation** : Choix de design volontaire possible (chaque entité est indépendante), mais le mapping `DbRow → ApiStruct` pourrait être simplifié en implémentant `From<DbRow> for ApiStruct`.

---

### 3.2 — Complexité Excessive

---

#### REFACTO-011 — `reconstruct_spec` : nesting excessif

- **Fichier** : [docker/info.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/docker/info.rs#L128-L176)
- **Type** : Complexité
- **Impact** : **Élevé** — La fonction `reconstruct_spec` contient des imbrications `if let` de 6 niveaux de profondeur pour extraire les port bindings. Très difficile à lire et modifier.
- **Description** : Le bloc L128-L149 fait `if let Some(host_config) → if let Some(port_bindings) → for (port_str, bindings) → if let Some(bindings) → for binding → if let Some(host_port_str) → if let Ok(host_port)`.
- **Recommandation** : Utiliser des combinateurs `.and_then()`, `.flat_map()`, ou des `let-else` (Rust 1.65+) pour aplatir la logique. Exemple :

  ```rust
  let ports = inspect.host_config.as_ref()
      .and_then(|hc| hc.port_bindings.as_ref())
      .map(|bindings| {
          bindings.iter().flat_map(|(port_str, host_bindings)| {
              // flatten logic here
          }).collect()
      })
      .unwrap_or_default();
  ```

---

#### REFACTO-018 — `server_ping` : nesting profond pour l'extraction de port

- **Fichier** : [ping.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/ping.rs#L26-L50)
- **Type** : Complexité
- **Impact** : **Moyen** — Même problème de nesting profond que REFACTO-011, avec une extraction de port qui fait 6+ niveaux d'imbrication.
- **Recommandation** : Extraire la logique en une fonction `fn extract_host_port(inspect: &ContainerInspectResponse, default: u16) -> u16`.

---

### 3.3 — Séparation des Responsabilités

---

#### REFACTO-004 — Logique de backfill inline dans main.rs

- **Fichier** : [main.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/main.rs#L68-L104)
- **Type** : Séparation des responsabilités
- **Impact** : **Élevé** — 36 lignes de logique métier complexe (requêtes SQL, reconstruction de specs Docker, gestion d'erreurs) directement dans `fn main()`. Cela rend main difficile à lire et impossible à tester unitairement.
- **Recommandation** : Extraire en `db::backfill_unmanaged_containers(pool: &SqlitePool, docker: &DockerManager, containers: &[ServerStatusResponse]) -> Result<usize>`.

---

#### REFACTO-008 — UserAuth fait des requêtes DB dans un extractor

- **Fichier** : [auth.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/auth.rs#L139-L227)
- **Type** : Séparation des responsabilités
- **Impact** : **Élevé** — L'extractor `UserAuth` implémente `FromRequestParts<AppState>` et fait directement des requêtes SQL (L197-L218). Cela couple fortement l'authentification à la base de données et rend le testing et le mocking très difficiles. De plus, il définit une struct `DbUser` localement (L190-L195) plutôt que de la partager.
- **Recommandation** : Injecter un service `UserService` dans `AppState` qui encapsule les requêtes DB liées aux utilisateurs, et l'utiliser dans l'extractor.

---

#### REFACTO-009 — system/docker.rs : 433 lignes, 13+ handlers

- **Fichier** : [docker.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/system/docker.rs)
- **Type** : Séparation des responsabilités
- **Impact** : **Élevé** — Ce fichier contient 13+ route handlers (containers CRUD, images, prune, config), des structs de payload/query, et du code utilitaire (`build_docker_run_args`). C'est le fichier le plus volumineux du projet et viole clairement SRP.
- **Recommandation** : Découper en sous-modules : `docker/containers.rs`, `docker/images.rs`, `docker/config.rs`.

---

#### REFACTO-034 — Fallback silencieux vers "system" user

- **Fichier** : [auth.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/auth.rs#L220-L227)
- **Type** : Séparation des responsabilités
- **Impact** : **Moyen** — Si aucun header utilisateur n'est fourni et que le token node est valide, `UserAuth` retourne silencieusement un utilisateur "system" avec la permission `"*"`. Ce comportement implicite est dangereux : il est impossible de distinguer entre "pas d'utilisateur spécifié intentionnellement" et "le header a été oublié". Cela devrait être un comportement explicite et documenté.
- **Recommandation** : Rendre ce comportement explicite via un commentaire `# Safety` ou une variante `Option<UserAuth>` pour les routes qui acceptent les appels système sans contexte utilisateur.

---

### 3.4 — Anti-patterns

---

#### REFACTO-010 — Scheduler : jobs d'automation sont des no-ops

- **Fichier** : [scheduler.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/scheduler.rs#L28-L30)
- **Type** : Anti-pattern
- **Impact** : **Élevé** — Les jobs d'automation chargés depuis la DB ne font absolument rien d'utile : ils se contentent de loguer `"Running automation job: {} (Type: {})"`. L'infrastructure cron est en place, mais aucune action n'est exécutée. C'est du code trompeur — un utilisateur pourrait configurer des automations en pensant qu'elles sont actives.
- **Recommandation** : Soit implémenter la logique d'exécution réelle (backup, restart, etc.), soit documenter clairement que les automations sont en cours de développement et ne pas les exposer dans l'API.

---

#### REFACTO-022 — password_hash exposé dans la réponse API

- **Fichier** : [users.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/users.rs#L19)
- **Type** : Anti-pattern
- **Impact** : **Moyen** — La struct `UserResponse` contient un champ `password_hash: Option<String>` qui est sérialisé et renvoyé dans les réponses API. Même si le hash est opaque, exposer des hashes de mots de passe via une API REST est un anti-pattern de sécurité.
- **Recommandation** : Annoter le champ avec `#[serde(skip_serializing)]` ou utiliser une struct de réponse séparée sans le champ `password_hash`.

---

#### REFACTO-025 — Détection JWT par `starts_with("ey")`

- **Fichier** : [auth.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/auth.rs#L159)
- **Type** : Anti-pattern
- **Impact** : **Moyen** — La distinction entre un node token et un JWT est faite par `t.starts_with("ey")`. Bien que les JWT encodés en base64url commencent typiquement par `ey`, c'est une heuristique fragile. Un node token qui commencerait par `ey` serait mal routé.
- **Recommandation** : Utiliser un header séparé (`Authorization: Bearer <jwt>`) ou un préfixe explicite pour distinguer les deux types de tokens.

---

#### REFACTO-027 — `std::process::Command` bloquant en contexte async

- **Fichier** : [files/action.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/files/action.rs#L44-L78)
- **Type** : Anti-pattern
- **Impact** : **Moyen** — Les actions `Archive` et `Extract` utilisent `std::process::Command` (synchrone/bloquant) au lieu de `tokio::process::Command` dans un contexte async. Cela bloque le runtime Tokio pendant la durée de la commande `tar`, ce qui peut impacter les autres requêtes concurrentes, surtout sur de gros fichiers.
- **Recommandation** : Remplacer par `tokio::process::Command` ou wrapper dans `tokio::task::spawn_blocking`.

---

#### REFACTO-035 — `.unwrap()` dans fallback de Response builder

- **Fichier** : [download.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/files/download.rs#L23-L52)
- **Type** : Anti-pattern
- **Impact** : **Faible** — Plusieurs `.unwrap()` dans les `unwrap_or_else` des `Response::builder()`. En théorie, construire une réponse avec un status et un `Body::empty()` ne devrait jamais échouer, mais un `.expect("hardcoded response")` serait plus clair.
- **Recommandation** : Remplacer `.unwrap()` par `.expect("hardcoded status response cannot fail")` ou utiliser une fonction utilitaire `fn error_response(status: StatusCode, body: String) -> Response`.

---

### 3.5 — Code Mort

---

#### REFACTO-032 — `ProtocolVersionCheck` non utilisé

- **Fichier** : [auth.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/auth.rs#L105-L129)
- **Type** : Code mort
- **Impact** : **Moyen** — L'extractor `ProtocolVersionCheck` est entièrement implémenté mais marqué `#[allow(dead_code)]` et n'est utilisé nulle part. Il rajoute 24 lignes de code à maintenir.
- **Recommandation** : Supprimer si non prévu à court terme, ou retirer l'annotation `#[allow(dead_code)]` et l'intégrer dans les routes qui doivent vérifier la version du protocole.

---

#### REFACTO-033 — `get_server_status` non utilisé

- **Fichier** : [docker/info.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/docker/info.rs#L58-L96)
- **Type** : Code mort
- **Impact** : **Faible** — La méthode `get_server_status` est marquée `#[allow(dead_code)]`. Elle duplique partiellement la logique de `list_managed_containers` pour un seul conteneur.
- **Recommandation** : Supprimer ou intégrer dans une route (par ex. le handler `server_inspect` qui utilise actuellement le docker client directement).

---

### 3.6 — Gestion d'Erreurs

---

#### REFACTO-001 — Double appel à `db::init_db()` dans main.rs

- **Fichier** : [main.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/main.rs#L57-L66) et [main.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/main.rs#L111-L120)
- **Type** : Gestion d'erreurs / Dette technique
- **Impact** : **Élevé** — `db::init_db()` est appelé **deux fois** : une fois à la ligne 57, et une seconde fois à la ligne 111. La deuxième initialisation crée un deuxième pool de connexions et c'est ce pool qui est utilisé pour `AppState`. Le premier pool (utilisé pour le backfill) est abandonné sans être fermé. Cela gaspille des connexions et, surtout, le seeding du user admin et les migrations s'exécutent deux fois.
- **Recommandation** : Supprimer le second appel `db::init_db()` (L111-L120) et réutiliser le `db_pool` déjà initialisé.

---

#### REFACTO-012 — `if let Ok(...)` avale l'erreur de sérialisation dans create_server

- **Fichier** : [create.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/create.rs#L52-L59)
- **Type** : Gestion d'erreurs
- **Impact** : **Élevé** — Le code fait `if let Ok(spec_json) = serde_json::to_string(&payload.spec)` puis insère en DB. Si la sérialisation échoue (improbable mais possible), le serveur Docker est créé avec succès mais sans enregistrement en base — un état incohérent silencieux.
- **Recommandation** : Utiliser `?` avec conversion d'erreur explicite :

  ```rust
  let spec_json = serde_json::to_string(&payload.spec)
      .map_err(|e| DaemonError::Anyhow(e.into()))?;
  ```

---

#### REFACTO-013 — Erreurs DB silencieusement ignorées dans delete_server

- **Fichier** : [delete.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/delete.rs#L27-L35)
- **Type** : Gestion d'erreurs
- **Impact** : **Élevé** — Après la suppression réussie du conteneur Docker, le code fait `let _ = sqlx::query("DELETE FROM server_allocations…")` et `let _ = sqlx::query("DELETE FROM servers…")`. Si ces suppressions échouent, les données de DB deviennent orphelines sans aucun log ni notification.
- **Recommandation** : Au minimum loguer l'erreur avec `if let Err(e) = … { tracing::error!(…) }`. Idéalement, utiliser une transaction.

---

#### REFACTO-014 — `hash_password` unwrap sur bcrypt

- **Fichier** : [auth_routes.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/auth_routes.rs#L32)
- **Type** : Gestion d'erreurs
- **Impact** : **Moyen** — `hash(password, DEFAULT_COST).unwrap()` paniquera si bcrypt échoue (par exemple sur un mot de passe > 72 bytes, qui est la limite de bcrypt).
- **Recommandation** : Retourner un `Result` et propager l'erreur.

---

#### REFACTO-015 — `.lock().unwrap()` sur Mutex dans metrics.rs

- **Fichier** : [metrics.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/metrics.rs#L19-L21)
- **Type** : Gestion d'erreurs
- **Impact** : **Moyen** — 3 appels consécutifs à `.lock().unwrap()`. Si l'un des mutex est empoisonné (ce qui arrive si un thread panique en tenant le lock), cela crash l'ensemble du daemon. Vu que ce code tourne dans `spawn_blocking`, un panic dans le callback se propagerait.
- **Recommandation** : Utiliser `.lock().unwrap_or_else(|e| e.into_inner())` pour récupérer même après un empoisonnement, ou `.lock().expect("SYSINFO mutex poisoned — bug in metrics collector")` pour au moins avoir un message clair.

---

#### REFACTO-016 — `.lock().unwrap()` dans le rate limiter

- **Fichier** : [routes/mod.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/mod.rs#L44)
- **Type** : Gestion d'erreurs
- **Impact** : **Moyen** — Le middleware de rate limiting fait `state.lock().unwrap()` sur le Mutex. Un empoisonnement ici crasherait **toutes les requêtes entrantes**.
- **Recommandation** : Même solution que REFACTO-015. Alternativement, utiliser un `DashMap` (lock-free) pour éviter complètement les Mutex.

---

#### REFACTO-017 — `.unwrap()` sur PTY reader/writer

- **Fichier** : [pty.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/system/pty.rs#L77-L78)
- **Type** : Gestion d'erreurs
- **Impact** : **Moyen** — `pair.master.try_clone_reader().unwrap()` et `pair.master.take_writer().unwrap()` peuvent panic si le PTY est dans un état invalide.
- **Recommandation** : Gérer l'erreur et envoyer un message d'erreur via le WebSocket avant de retourner.

---

### 3.7 — Incohérences Architecturales

---

#### REFACTO-005 — Mix entre `DaemonError` et `Json<ApiResponse>` comme types de retour

- **Fichier** : Toutes les routes
- **Type** : Incohérence architecturale
- **Impact** : **Élevé** — Il y a 3 patterns différents utilisés pour le retour d'erreur dans les handlers :
  1. `Result<Json<ApiResponse<T>>, DaemonError>` — utilisé par `create`, `delete`, `patch`, `users`, `allocations`
  2. `Json<ApiResponse<T>>` (erreur dans le body, status 200) — utilisé par `list_servers`, `ping`, `crashes`, `logs`, `files/*`, `system/docker`
  3. `impl IntoResponse` avec status codes manuels — utilisé par `power`, `command`, `read`
  
  Cette incohérence rend le code difficile à comprendre et impossible à consommer de manière uniforme côté client.
- **Recommandation** : Standardiser sur le pattern `Result<Json<ApiResponse<T>>, DaemonError>` pour tous les handlers. L'implémentation `IntoResponse` de `DaemonError` existe déjà et gère correctement les status codes HTTP.

---

#### REFACTO-021 — Chemins hardcodés pour les backups

- **Fichier** : [backups.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/system/backups.rs#L24-L58)
- **Type** : Incohérence architecturale
- **Impact** : **Moyen** — Les chemins `"./data/backups/{}"` et `"/var/lib/docker/volumes/{}_data/_data"` sont hardcodés alors que le reste du code utilise `config.data_dir` pour les chemins de données. Le chemin Docker en particulier ne fonctionnera pas avec des bind mounts (l'approche actuelle du projet).
- **Recommandation** : Utiliser `config.data_dir` pour le chemin source et rendre le backup_dir configurable.

---

#### REFACTO-024 — Migrations manuelles avec `.ok()`

- **Fichier** : [db.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/db.rs#L93-L106)
- **Type** : Incohérence architecturale
- **Impact** : **Moyen** — Les migrations de schéma (`ALTER TABLE … ADD COLUMN`) sont faites avec `.ok()` pour ignorer les erreurs si la colonne existe déjà. C'est un pattern fonctionnel mais fragile — il masquerait aussi d'autres erreurs SQL réelles (permission denied, disk full, etc.).
- **Recommandation** : Vérifier le message d'erreur avant de l'ignorer :

  ```rust
  match sqlx::query("ALTER TABLE …").execute(&pool).await {
      Ok(_) => tracing::info!("Migration applied"),
      Err(e) if e.to_string().contains("duplicate column") => {},
      Err(e) => return Err(e.into()),
  }
  ```

  Ou mieux : utiliser le système de migrations SQLx (`sqlx::migrate!`).

---

#### REFACTO-026 — Messages d'erreur en français mélangés à l'anglais

- **Fichiers** : [auth_routes.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/auth_routes.rs#L92), [users.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/users.rs#L101-L170), [patch.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/patch.rs#L26), [create.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/servers/create.rs#L35-L36), [docker.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/system/docker.rs#L59)
- **Type** : Incohérence architecturale
- **Impact** : **Moyen** — Certains messages d'erreur sont en français (`"Mot de passe incorrect ou utilisateur introuvable"`, `"Le port {} est déjà utilisé"`, `"Un compte superadmin ne peut pas être supprimé"`), tandis que la majorité du code et des logs sont en anglais. Cela rend l'expérience utilisateur incohérente.
- **Recommandation** : Choisir une seule langue pour les messages d'erreur API. Si le frontend fait l'i18n, utiliser des codes d'erreur plutôt que des messages humains.

---

#### REFACTO-036 — Mix de line endings

- **Fichiers** : Les fichiers sous `routes/v1/files/` et `routes/v1/system/docker.rs` utilisent `\r\n` (CRLF), tandis que tout le reste du projet utilise `\n` (LF).
- **Type** : Incohérence architecturale
- **Impact** : **Faible** — Pas d'impact fonctionnel, mais génère du bruit dans les diffs.
- **Recommandation** : Configurer un `.gitattributes` avec `* text=auto` et normaliser tous les fichiers en LF.

---

### 3.8 — Tests Manquants

---

#### REFACTO-006 — Zéro tests dans le projet

- **Fichier** : Aucun fichier de test dans tout le projet
- **Type** : Tests manquants
- **Impact** : **Élevé** — Le projet ne contient aucun test unitaire, aucun test d'intégration, aucun `#[cfg(test)]` module. Des fonctions critiques comme `sanitize_path`, `require_permission`, `atomic_binary_swap`, la logique d'authentification, et les validations de port sont entièrement non testées.
- **Recommandation** : Prioriser les tests pour :
  1. `files::sanitize_path` — la fonction de sécurité la plus critique (traversal prevention)
  2. `auth::UserAuth::require_permission` — la logique de permissions
  3. `db::init_db` — les migrations et le seeding
  4. `update::AutoUpdater` — la logique de swap atomique

---

### 3.9 — Performance

---

#### REFACTO-023 — Création d'un `System::new()` à chaque requête

- **Fichiers** : [host.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/system/host.rs#L8), [health.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/system/health.rs#L14), [memory.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/system/memory.rs#L7)
- **Type** : Performance
- **Impact** : **Moyen** — Chaque appel à `/system/host`, `/system/health`, ou `/system/memory` crée un nouveau `sysinfo::System`, un nouveau `sysinfo::Disks`, etc. Ces allocations sont coûteuses (sysinfo fait du parsing de `/proc`). Ironiquement, `metrics.rs` utilise déjà un `lazy_static` pour son instance — ce pattern n'est pas réutilisé.
- **Recommandation** : Réutiliser l'instance globale de `SYSINFO` définie dans `metrics.rs`, ou mieux, créer un `SystemInfoService` partagé dans `AppState`.

---

#### REFACTO-028 — `lazy_static!` + `Mutex` au lieu de `std::sync::LazyLock`

- **Fichier** : [metrics.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/metrics.rs#L6-L14)
- **Type** : Performance
- **Impact** : **Moyen** — Le projet utilise la crate `lazy_static` (dépendance externe) alors que `std::sync::LazyLock` est stabilisé depuis Rust 1.80 et fait partie de la stdlib. Cela permettrait de supprimer la dépendance `lazy_static`.
- **Recommandation** : Remplacer `lazy_static! { static ref X: Mutex<T> = … }` par `static X: LazyLock<Mutex<T>> = LazyLock::new(|| …)`.

---

#### REFACTO-029 — Lecture du fichier entier en mémoire pour le hashing

- **Fichier** : [files/hash.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/files/hash.rs#L9-L10)
- **Type** : Performance
- **Impact** : **Faible** — `hash_file` et `hash_multiple_files` lisent la totalité du fichier en mémoire avec `tokio::fs::read(path)` avant de le hasher. Pour de gros fichiers (fichiers monde Minecraft qui peuvent faire plusieurs Go), cela utilise une quantité de RAM proportionnelle à la taille du fichier.
- **Recommandation** : Lire le fichier en streaming avec des buffers de taille fixe et alimenter le hasher de manière incrémentale.

---

### 3.10 — Dette Technique

---

#### REFACTO-030 — TODO et code commenté dans update.rs

- **Fichier** : [update.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/update.rs#L155-L157)
- **Type** : Dette technique
- **Impact** : **Moyen** — Un TODO (`// TODO: Improve CI/CD pipeline.`) et une ligne de code commentée (`// let asset_name = format!("daemon-{}-{}", os, arch);`) sont restés en place. Le code actuel utilise `format!("daemon")` sans tenir compte de l'OS/arch, ce qui est un workaround temporaire devenu permanent.
- **Recommandation** : Soit résoudre le TODO (implémenter la logique multi-arch), soit documenter clairement la limitation actuelle et supprimer le code commenté.

---

#### REFACTO-031 — TODO sur la suppression dynamique d'automations

- **Fichier** : [automations.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/routes/v1/automations.rs#L114)
- **Type** : Dette technique
- **Impact** : **Moyen** — `// TODO: dynamically remove from tokio-cron-scheduler` — quand un automation est supprimée de la DB, le job cron correspondant continue de tourner jusqu'au prochain redémarrage du daemon. Combiné avec REFACTO-010 (les jobs sont des no-ops), l'impact est actuellement nul mais deviendrait un bug dès que les automations seront fonctionnelles.
- **Recommandation** : Implémenter la suppression dynamique via `JobScheduler::remove()` ou au minimum documenter la limitation.

---

#### REFACTO-037 — Erreur du scheduler silencieusement avalée

- **Fichier** : [main.rs](file:///c:/Users/iswea/Desktop/vps-panel/daemon/src/main.rs#L122-L124)
- **Type** : Dette technique
- **Impact** : **Élevé** — Si `scheduler::start_scheduler(…)` échoue, l'erreur est imprimée avec `eprintln!` mais le daemon continue de tourner normalement. L'erreur n'est même pas loguée via tracing (contrairement au reste du code) et le scheduler n'est pas retourné/stocké, ce qui signifie qu'il est immédiatement droppé et que les jobs planifiés ne s'exécuteront jamais.
- **Recommandation** : Stocker le `JobScheduler` retourné dans `AppState` (pour ne pas le dropper) et utiliser `tracing::error!` au lieu de `eprintln!`.

---

## 4. Récapitulatif de Couverture

### Fichiers analysés : **46 / 46** (100%)

| Catégorie | Fichiers | Statut |
|---|---|---|
| **Config / Build** | `Cargo.toml` | ✅ Analysé |
| **Documentation** | `VISION.md`, 4 fichiers API docs, `openapi.yaml` | ✅ Analysés (hors périmètre refactoring) |
| **Source — Core** | `main.rs`, `config.rs`, `db.rs`, `error.rs`, `auth.rs`, `console.rs`, `metrics.rs`, `scheduler.rs`, `update.rs` | ✅ Analysés |
| **Source — Docker** | `mod.rs`, `create.rs`, `delete.rs`, `general.rs`, `info.rs`, `power.rs`, `tty.rs` | ✅ Analysés |
| **Source — Files** | `mod.rs`, `action.rs`, `hash.rs`, `list.rs`, `read.rs`, `write.rs` | ✅ Analysés |
| **Source — Routes** | `mod.rs`, `v1/mod.rs` | ✅ Analysés |
| **Source — Routes v1** | `auth_routes.rs`, `automations.rs`, `history.rs`, `sessions.rs`, `users.rs` | ✅ Analysés |
| **Source — Routes files** | `mod.rs`, `action.rs`, `download.rs`, `hash.rs`, `list.rs`, `read.rs`, `upload.rs`, `write.rs` | ✅ Analysés |
| **Source — Routes servers** | `mod.rs`, `command.rs`, `crashes.rs`, `create.rs`, `delete.rs`, `inspect.rs`, `list.rs`, `logs.rs`, `patch.rs`, `ping.rs`, `power.rs`, `ws.rs` | ✅ Analysés |
| **Source — Routes system** | `mod.rs`, `allocations.rs`, `backups.rs`, `crontab.rs`, `docker.rs`, `health.rs`, `host.rs`, `info.rs`, `logs.rs`, `memory.rs`, `metrics.rs`, `pty.rs`, `update.rs` | ✅ Analysés |

### Fichiers exclus : **0**

Tous les fichiers du projet ont été lus et analysés. Le crate `protocol` (dépendance locale `path = "../protocol"`) n'a pas été analysé car hors du scope du workspace `daemon`, mais ses types sont référencés dans le rapport lorsque pertinent.

---

## 5. Hors Périmètre (notes brèves)

> [!NOTE]
> Les points suivants ont été repérés pendant l'audit mais sont hors périmètre (bugs fonctionnels ou failles de sécurité). Ils ne sont listés ici que pour ne pas les perdre.

- **Sécurité** : `privileged: Some(true)` et `security_opt: ["seccomp=unconfined", "apparmor=unconfined"]` dans `docker/create.rs` L48-L52 — les conteneurs créés ont des privilèges root complets sur l'hôte.
- **Sécurité** : L'endpoint `/api/v1/system/host/exec` accepte des commandes shell arbitraires et les exécute en tant que l'utilisateur du daemon (probablement root).
- **Sécurité** : Le mot de passe admin par défaut `"changeme"` est hardcodé et il n'y a aucun mécanisme de force-change au premier login.
- **Bug latent** : `db::init_db()` appelé deux fois (déjà documenté dans REFACTO-001).
- **Bug latent** : Le `JobScheduler` retourné par `start_scheduler` n'est pas stocké → il est droppé et les jobs sont annulés (déjà documenté dans REFACTO-037).
