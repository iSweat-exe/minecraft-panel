# Checklist de Refactoring — Daemon minecraft-panel

> Basée sur l'audit de qualité du 2026-07-25 (37 problèmes identifiés). Cocher au fur et à mesure.

**Progression** : 37 / 37 (100% Terminé 🎉)

---

## 🔴 Priorité Élevée (13)

- [x] **REFACTO-001** — `main.rs` L57-120 : supprimer le double appel à `db::init_db()` (2e pool abandonné, seeding/migrations exécutés 2x)
- [x] **REFACTO-002** — 12 fichiers : extraire `format!("mc-server-{}", server_id)` en `DockerManager::container_name()`
- [x] **REFACTO-003** — 21 call sites : unifier le pattern de vérification de permission (`require_permission` → `Result<(), DaemonError>`)
- [x] **REFACTO-004** — `main.rs` L68-104 : extraire le backfill inline en `db::backfill_unmanaged_containers()`
- [x] **REFACTO-005** — Toutes les routes : standardiser sur `Result<Json<ApiResponse<T>>, DaemonError>` partout (3 patterns coexistent actuellement)
- [x] **REFACTO-006** — Zéro tests dans le projet : prioriser `sanitize_path`, `require_permission`, `init_db`, `atomic_binary_swap`
- [x] **REFACTO-007** — `update.rs` : extraire `atomic_binary_swap()` réutilisable (dupliqué L92-104 et L207-217)
- [x] **REFACTO-008** — `auth.rs` L139-227 : sortir les requêtes DB de l'extractor `UserAuth`, passer par un `UserService` dans `AppState`
- [x] **REFACTO-009** — `system/docker.rs` (433 lignes, 13+ handlers) : découper en `docker/containers.rs`, `docker/images.rs`, `docker/config.rs`
- [x] **REFACTO-010** — `scheduler.rs` L28-30 : implémenter la logique réelle des jobs d'automation (actuellement no-op, juste un log)
- [x] **REFACTO-011** — `docker/info.rs` L128-176 : aplatir `reconstruct_spec` (nesting 6 niveaux) avec `.and_then()`/`let-else`
- [x] **REFACTO-012** — `create.rs` L52-59 : remplacer le `if let Ok(...)` qui avale l'erreur de sérialisation par un `?` explicite
- [x] **REFACTO-013** — `delete.rs` L27-35 : logger (ou transactionner) les `let _ =` sur suppression DB après delete Docker
- [x] **REFACTO-037** — `main.rs` L122-124 : stocker le `JobScheduler` dans `AppState` (sinon droppé → jobs jamais exécutés) + `tracing::error!` au lieu de `eprintln!`

---

## 🟡 Priorité Moyenne (20)

- [x] **REFACTO-014** — `auth_routes.rs` L32 : remplacer `hash(password, DEFAULT_COST).unwrap()` par une propagation d'erreur
- [x] **REFACTO-015** — `metrics.rs` L19-21 : gérer l'empoisonnement des 3 `.lock().unwrap()`
- [x] **REFACTO-016** — `routes/mod.rs` L44 : idem sur le rate limiter (`state.lock().unwrap()` crasherait toutes les requêtes)
- [x] **REFACTO-017** — `pty.rs` L77-78 : gérer l'erreur sur `.unwrap()` reader/writer PTY plutôt que paniquer
- [x] **REFACTO-018** — `ping.rs` L26-50 : extraire l'extraction de port en `extract_host_port()` (nesting 6+ niveaux)
- [x] **REFACTO-019** — `create.rs` + `patch.rs` : extraire `allocate_ports()` commune (validation/allocation dupliquée)
- [x] **REFACTO-020** — `automations.rs` / `history.rs` / `sessions.rs` : simplifier le mapping `DbRow → ApiStruct` via `From<DbRow>`
- [x] **REFACTO-021** — `backups.rs` L58 : remplacer les chemins hardcodés par `config.data_dir` (le chemin Docker actuel casse avec des bind mounts)
- [x] **REFACTO-022** — `users.rs` L19 : ne plus sérialiser `password_hash` dans `UserResponse` (`#[serde(skip_serializing)]` ou struct dédiée)
- [x] **REFACTO-023** — `host.rs` / `health.rs` / `memory.rs` : réutiliser une instance `SystemInfoService` partagée au lieu de `System::new()` par requête
- [x] **REFACTO-024** — `db.rs` L93-106 : remplacer les migrations `.ok()` par un check du message d'erreur, ou passer à `sqlx::migrate!`
- [x] **REFACTO-025** — `auth.rs` L159 : remplacer la détection JWT par `starts_with("ey")` par un header/préfixe explicite
- [x] **REFACTO-026** — Messages d'erreur : choisir une langue unique (FR ou EN) sur `auth_routes.rs`, `users.rs`, `patch.rs`, `create.rs`, `docker.rs`
- [x] **REFACTO-027** — `files/action.rs` L44-82 : remplacer `std::process::Command` (bloquant) par `tokio::process::Command` ou `spawn_blocking`
- [x] **REFACTO-028** — `metrics.rs` L6-14 : remplacer `lazy_static!` + `Mutex` par `std::sync::LazyLock` (retirer la dépendance)
- [x] **REFACTO-030** — `update.rs` L155-157 : résoudre ou documenter le TODO multi-arch, retirer le code commenté
- [x] **REFACTO-031** — `automations.rs` L114 : implémenter la suppression dynamique du job cron (`JobScheduler::remove()`)
- [x] **REFACTO-032** — `auth.rs` L105-129 : décider du sort de `ProtocolVersionCheck` (l'intégrer ou le supprimer, pas le laisser en `#[allow(dead_code)]`)
- [x] **REFACTO-034** — `auth.rs` L220-227 : rendre explicite le fallback silencieux vers l'utilisateur "system" (commentaire `# Safety` ou `Option<UserAuth>`)

---

## 🟢 Priorité Faible (4)

- [x] **REFACTO-029** — `files/hash.rs` : passer d'une lecture complète en mémoire à un hashing en streaming (impact RAM sur gros fichiers)
- [x] **REFACTO-033** — `docker/info.rs` L58 : supprimer ou intégrer `get_server_status` (actuellement `#[allow(dead_code)]`)
- [x] **REFACTO-035** — `download.rs` : remplacer `.unwrap()` par `.expect("...")` explicite dans les fallbacks de `Response::builder()`
- [x] **REFACTO-036** — Normaliser les line endings (mix `\r\n`/`\n`) via `.gitattributes`

---

## ⚠️ Hors périmètre — à traiter séparément (sécurité, non coché ici)

Repérés pendant l'audit qualité mais **non inclus** dans cette checklist de refactoring — nécessitent un suivi dédié :
- `privileged: true` + `seccomp/apparmor=unconfined` sur les containers créés (`docker/create.rs`)
- `/api/v1/system/host/exec` : exécution de commandes shell arbitraires
- Mot de passe admin par défaut `"changeme"` sans forçage de changement au premier login