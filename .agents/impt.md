# Plan d'implémentation — Minecraft Server Manager

**Stack** : Tauri v2 · React 18 · TailwindCSS · Rust (russh)
**Cible** : VPS Ubuntu 26 / Minecraft Fabric 26.2, service `minecraft` piloté via `screen`
**Rédigé le** : 17 juillet 2026 par Claude Sonnet 5 (Max)

> Les versions de dépendances citées dans ce document ont été vérifiées en direct sur crates.io / npm au moment de la rédaction. Revérifie-les tout de même avant de démarrer si tu commences le code plusieurs semaines après avoir lu ce fichier.

---

## Sommaire

1. [Contexte & objectif](#1-contexte--objectif)
2. [Prérequis côté VPS (à faire une fois)](#2-prérequis-côté-vps-à-faire-une-fois)
3. [Stack & dépendances](#3-stack--dépendances)
4. [Architecture générale](#4-architecture-générale)
5. [Arborescence du projet](#5-arborescence-du-projet)
6. [Contrats IPC (commands & events)](#6-contrats-ipc-commands--events)
7. [Détails d'implémentation par module](#7-détails-dimplémentation-par-module)
8. [Roadmap par phases](#8-roadmap-par-phases)
9. [Sécurité — checklist](#9-sécurité--checklist)
10. [Stratégie de tests](#10-stratégie-de-tests)
11. [Packaging & distribution](#11-packaging--distribution)
12. [Pièges connus à ne pas reproduire](#12-pièges-connus-à-ne-pas-reproduire)
13. [Évolutions futures (hors V1)](#13-évolutions-futures-hors-v1)

---

## 1. Contexte & objectif

Remplacer la gestion 100% CLI/SSH manuelle du serveur Minecraft par une application desktop locale (Tauri) qui communique avec le VPS **exclusivement via SSH** (pas de RCON, pas de panel web côté serveur). L'app doit couvrir :

- Démarrage / arrêt / redémarrage / statut du service `minecraft`
- Console en direct + envoi de commandes dans le jeu
- Explorateur de fichiers SFTP (upload/download de mondes, configs, backups)
- Le tout de façon sécurisée (pas de sudo si possible, pas de credentials en clair, pas d'injection de commande)

Le service systemd existant (`Type=forking` + `screen -dmS minecraft`) est conservé tel quel — l'app vient se brancher dessus, elle ne le remplace pas.

## 2. Prérequis côté VPS (à faire une fois)

Ces étapes se font **avant** d'écrire une ligne de code client, en te connectant en SSH classique.

### 2.1 Compte SSH dédié (si pas déjà fait)
Un compte non-root avec clé publique déployée, propriétaire des fichiers sous `/minecraft`.

### 2.2 Choix du mode de contrôle du service : `--user` vs sudo scopé

| | `systemctl --user` (recommandé) | sudoers scopé |
|---|---|---|
| Privilège requis par l'app | Aucun | `NOPASSWD` limité à 3-4 commandes |
| Setup VPS | Déplacer l'unit vers `~/.config/systemd/user/`, puis `loginctl enable-linger <user>` (une fois, avec un compte root/polkit) | Ajouter un fichier dans `/etc/sudoers.d/` |
| Risque | Aucune élévation possible depuis l'app | Surface d'attaque limitée mais non nulle |

**Recommandation** : migre vers `systemctl --user`. Le fichier unit reste identique (`Type=forking`, `screen -dmS`), seul son emplacement change :

```bash
mkdir -p ~/.config/systemd/user
mv /etc/systemd/system/minecraft.service ~/.config/systemd/user/minecraft.service
systemctl --user daemon-reload
systemctl --user enable --now minecraft
sudo loginctl enable-linger $(whoami)   # pour que ça tourne même sans session SSH ouverte
```

Si tu préfères garder le service system-wide existant tel quel (par ex. si un autre outil en dépend), utilise l'option sudoers scopée donnée dans l'échange précédent — l'app fonctionnera identiquement, seule la commande shell exécutée diffère (`sudo systemctl` au lieu de `systemctl --user`).

### 2.3 Empreinte de la clé hôte (pour le pinning, voir §7.1)

```bash
ssh-keyscan -t ed25519 ton-vps | ssh-keygen -lf -
```
Note le résultat (`SHA256:...`) quelque part — l'app le redemandera à la première connexion pour confirmation (TOFU), mais l'avoir sous la main permet de vérifier hors-bande que rien n'a été intercepté.

### 2.4 Chemins absolus à confirmer
`/minecraft/start.sh`, `/minecraft/logs/latest.log`, `/minecraft/server.properties` — ce sont les chemins utilisés dans tout le reste de ce document ; adapte si les tiens diffèrent.

## 3. Stack & dépendances

### 3.1 Backend (Rust / src-tauri)

| Crate | Version stable actuelle | Rôle |
|---|---|---|
| `tauri` | 2.11.5 | Framework |
| `tokio` | 1.52.4 (feature `full`) | Runtime async |
| `russh` | 0.62.2 | Client SSH (channels exec + réutilisable pour SFTP) |
| `russh-sftp` | 2.3.0 | Sous-système SFTP par-dessus un channel russh |
| `serde` | 1.0.228 (feature `derive`) | (Dé)sérialisation des payloads IPC |
| `keyring` | 4.1.5 | Stockage de la passphrase dans le trousseau OS |
| `thiserror` | 2.0.18 | Erreurs typées |
| `anyhow` | 1.0.103 | Erreurs "catch-all" en interne |
| `tauri-plugin-store` | 2.4.3 | Persistance des préférences (host, user, chemins distants) |
| `tauri-plugin-notification` | 2.3.3 | Alertes si le service tombe |

**Note importante sur `russh` 0.62** : le chargement de clés (`load_secret_key`, etc.) est désormais réexporté directement via `russh::keys::*` — tu n'as en général plus besoin d'ajouter `russh-keys` comme dépendance séparée dans ton `Cargo.toml`, seulement `russh` avec les features adéquates. Vérifie la doc de la version exacte au moment de coder, ce point a bougé plusieurs fois dans l'historique du projet.

**Alternative pour la couche SSH** : il existe un crate plus haut niveau, `russh-extra`, qui expose du pinning de clé hôte en une ligne (`try_pinned_host_key_sha256(...)`) et une API client plus ergonomique. Il est pratique mais encore **pre-1.0** — pour une brique aussi sensible que l'authentification SSH, je recommande de partir sur `russh` brut (mature, utilisé en prod par d'autres outils comme des gestionnaires de mots de passe) et d'implémenter le TOFU à la main (voir §7.1). Tu peux réévaluer `russh-extra` plus tard si son API se stabilise.

### 3.2 Frontend (React)

| Package | Version actuelle | Rôle |
|---|---|---|
| `zustand` | 5.0.14 | State management léger |
| `react-window` | 2.2.7 | Virtualisation de la liste de logs (perf sur un flux continu) |
| `@tauri-apps/api` | fournie par le template Tauri v2 | `invoke` / `listen` |

### 3.3 Bootstrap

```bash
npm create tauri-app@latest minecraft-manager -- --template react-ts
cd minecraft-manager
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install zustand react-window

cd src-tauri
cargo add tauri --features ""
cargo add tokio --features full
cargo add russh russh-sftp
cargo add serde --features derive
cargo add keyring thiserror anyhow
cargo add tauri-plugin-store tauri-plugin-notification
```

## 4. Architecture générale

```
┌───────────────────────────────┐
│  Frontend (React + Tailwind)   │
│  Dashboard / Console / Files   │
└───────────────┬─────────────────┘
                │ invoke() / listen()
┌───────────────▼─────────────────┐
│         Tauri IPC (Rust)         │
│  commands/{connection,service,   │
│           console,files}.rs      │
│  state.rs (session SSH partagée) │
└───────────────┬─────────────────┘
                │ 1 seule connexion TCP,
                │ plusieurs channels multiplexés
┌───────────────▼─────────────────┐
│           VPS Ubuntu 26           │
│  systemd --user (minecraft.service)│
│  screen -S minecraft (console jeu) │
│  sftp-server (OpenSSH, natif)      │
│  /minecraft/logs/latest.log        │
└───────────────────────────────────┘
```

**Décision clé : une seule session SSH, plusieurs channels.** Exec (`systemctl`), console (`tail -F`), et SFTP tournent sur des *channels* distincts d'une **unique** connexion `russh::client::Handle`, stockée dans `tauri::State`. Évite d'ouvrir 3 connexions TCP séparées, simplifie la reconnexion (un seul point de défaillance à surveiller) et respecte mieux `MaxSessions` côté sshd.

## 5. Arborescence du projet

```
minecraft-manager/
├── src/                          # Frontend React
│   ├── components/
│   │   ├── ConnectionGate.tsx    # Écran de connexion / statut SSH
│   │   ├── Dashboard.tsx         # Vue d'ensemble (statut, RAM/CPU, joueurs)
│   │   ├── ConsolePanel.tsx      # Logs live + input de commande
│   │   ├── FileExplorer.tsx      # Navigateur SFTP
│   │   ├── ServerControls.tsx    # Boutons start/stop/restart
│   │   └── SettingsPanel.tsx     # Host, user, chemins, clé SSH
│   ├── store/
│   │   ├── connectionStore.ts
│   │   ├── consoleStore.ts
│   │   └── filesStore.ts
│   ├── lib/tauriBridge.ts        # Wrapper typé autour de invoke/listen
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── ssh/
│   │   │   ├── mod.rs
│   │   │   ├── connection.rs     # Connexion, auth, handler TOFU
│   │   │   ├── exec.rs           # Wrapper exec générique
│   │   │   └── sftp.rs           # Session SFTP + validation de chemins
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── connection.rs
│   │   │   ├── service.rs
│   │   │   ├── console.rs
│   │   │   └── files.rs
│   │   ├── state.rs              # SshState, ConsoleState partagés
│   │   └── error.rs              # AppError (thiserror) + From<...>
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

## 6. Contrats IPC (commands & events)

### 6.1 Commands (`invoke`)

| Command | Args | Retour | Description |
|---|---|---|---|
| `ssh_connect` | `host, port, username, key_path` | `()` | Ouvre la session, déclenche le TOFU si 1ère connexion |
| `ssh_disconnect` | — | `()` | Ferme proprement tous les channels + la session |
| `ssh_status` | — | `ConnectionState` | `Connected \| Disconnected \| Reconnecting` |
| `service_action` | `action: ServiceAction` | `ServiceState` | Start/Stop/Restart via `systemctl --user` |
| `service_status` | — | `ServiceState { active_state, sub_state }` | Lecture seule |
| `console_send_command` | `cmd: String` | `()` | `screen -X stuff` avec échappement |
| `console_subscribe` | — | `()` | Démarre le `tail -F`, émet `console-line` |
| `console_unsubscribe` | — | `()` | Ferme le channel de tail |
| `sftp_list` | `path: String` | `FileEntry[]` | Liste un répertoire distant |
| `sftp_upload` | `local_path, remote_path` | `transfer_id` | Progress via événement |
| `sftp_download` | `remote_path, local_path` | `transfer_id` | Progress via événement |
| `sftp_delete` / `sftp_rename` / `sftp_mkdir` | chemins | `()` | Validées contre le path traversal |
| `settings_get` / `settings_set` | — / préférences | préférences | Via `tauri-plugin-store` |

### 6.2 Events (`emit` → `listen`)

| Event | Payload | Émis par |
|---|---|---|
| `connection-status` | `{ state, detail? }` | Health-check périodique + reconnexion |
| `console-line` | `{ line, timestamp }` | Channel `tail -F` |
| `service-state-changed` | `{ active_state, sub_state }` | Poll périodique `systemctl show` |
| `transfer-progress` | `{ id, bytes, total, direction }` | Upload/download SFTP en cours |
| `player-joined` / `player-left` | `{ name }` | Parsing optionnel des lignes de log |

## 7. Détails d'implémentation par module

### 7.1 Couche SSH — connexion & host key pinning

Le point à corriger par rapport à un `check_server_key` qui retourne toujours `Ok(true)` (vu dans l'échange précédent) : implémenter un vrai TOFU (*Trust On First Use*).

```rust
pub struct SshHandler {
    pub expected_fingerprint: Option<String>,
    pub app_handle: tauri::AppHandle,
}

impl russh::client::Handler for SshHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        key: &russh::keys::PublicKey,
    ) -> Result<bool, Self::Error> {
        let fingerprint = key.fingerprint(russh::keys::HashAlg::Sha256).to_string();

        match &self.expected_fingerprint {
            // Déjà connu (stocké via tauri-plugin-store) : comparaison stricte
            Some(expected) => Ok(expected == &fingerprint),
            // Première connexion : on émet un event, le front affiche une modale
            // de confirmation (fingerprint affiché) avant de retourner true.
            // Ne JAMAIS accepter silencieusement ici.
            None => {
                let _ = self.app_handle.emit("host-key-verification-needed", fingerprint);
                Ok(false) // on rejette cette tentative, l'utilisateur relance après confirmation
            }
        }
    }
}
```

Le flux complet : 1ère connexion → fingerprint affiché à l'utilisateur (avec l'empreinte relevée en §2.3 pour comparaison hors-bande) → confirmation → stockage via `settings_set` → connexions suivantes comparées automatiquement.

### 7.2 Contrôle du service

Utiliser un enum plutôt qu'une string brute venant du front, pour qu'aucune commande arbitraire ne puisse jamais être construite dynamiquement :

```rust
#[derive(serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceAction { Start, Stop, Restart }

impl ServiceAction {
    fn verb(&self) -> &'static str {
        match self { Self::Start => "start", Self::Stop => "stop", Self::Restart => "restart" }
    }
}

#[tauri::command]
async fn service_action(action: ServiceAction, state: tauri::State<'_, SshState>) -> Result<(), String> {
    run_exec(&state, &format!("systemctl --user {}", action.verb())).await?;
    Ok(())
}
```

Pour le statut, préfère un format machine-readable à `systemctl status` (texte destiné à l'humain, fragile à parser) :

```bash
systemctl --user show minecraft --property=ActiveState,SubState --value
```
```
active
running
```
Deux lignes, split simple, zéro regex fragile.

> **Nuance à connaître** : ton unit est en `Type=forking` sans `PIDFile=`. systemd doit alors *deviner* le PID principal via le cgroup (`GuessMainPID`, activé par défaut). Ça fonctionne bien en pratique avec `screen -dmS`, mais n'est pas garanti à 100 % si `screen` lui-même forke plusieurs process internes. Pour compenser, ajoute un health-check applicatif (voir §7.6) plutôt que de faire une confiance aveugle à `ActiveState=active` seul.

### 7.3 Console live

```rust
#[tauri::command]
async fn console_subscribe(app: tauri::AppHandle, state: tauri::State<'_, SshState>) -> Result<(), String> {
    let mut guard = state.session.lock().await;
    let session = guard.as_mut().ok_or("Non connecté")?;
    let mut channel = session.channel_open_session().await.map_err(|e| e.to_string())?;
    channel.exec(true, "tail -F -n 200 /minecraft/logs/latest.log").await.map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn(async move {
        while let Some(msg) = channel.wait().await {
            if let russh::ChannelMsg::Data { data } = msg {
                let text = String::from_utf8_lossy(&data).to_string();
                let _ = app.emit("console-line", text);
            }
        }
        // channel fermé (déconnexion ou fin de vie) : le front doit gérer
        // console_subscribe comme idempotent et le rappeler après reconnexion.
    });
    Ok(())
}
```

Points d'attention :
- **`-F` et non `-f`** : gère la rotation du log (le fichier est recréé à chaque redémarrage du serveur), indispensable ici.
- **Échappement des commandes envoyées** : toujours échapper les quotes avant d'injecter dans `stuff '...\015'` (déjà géré dans le code de l'échange précédent) — sinon un message joueur ou une commande contenant un guillemet casse la séquence `screen`.
- **Fermeture propre** : garder une référence au channel pour pouvoir le `close()` explicitement à la déconnexion / fermeture de l'app, sinon des process `tail` orphelins s'accumulent côté VPS au fil des sessions.
- **ANSI éventuels** : `logs/latest.log` est en général du texte brut (Log4j sans appender coloré), mais si un plugin/mod force des couleurs console, prévoir un strip des séquences `\x1b\[[0-9;]*m` côté parsing pour rester robuste plutôt que d'assumer que le log est toujours propre.

### 7.4 Explorateur SFTP

```rust
fn validate_remote_path(path: &str) -> Result<(), String> {
    const ROOT: &str = "/minecraft";
    let p = std::path::Path::new(path);
    if p.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Chemin invalide : '..' interdit".into());
    }
    if !path.starts_with(ROOT) {
        return Err(format!("Hors du périmètre autorisé ({ROOT})"));
    }
    Ok(())
}
```

Toute commande `sftp_*` passe par cette validation avant d'atteindre `russh-sftp`, même si le front est "de confiance" — ça évite qu'un bug d'UI (ex. un double-clic mal géré sur ".." dans l'arbre de fichiers) ne permette d'écrire hors de `/minecraft`.

Pour les transferts volumineux (mondes, backups), streamer la progression plutôt que d'attendre la fin :
```rust
app.emit("transfer-progress", TransferProgress { id, bytes: written, total, direction: "upload" });
```
avec une barre de progression React qui écoute cet event, mise à jour toutes les ~64-256 Ko plutôt qu'à chaque chunk (évite de spammer l'IPC).

### 7.5 État frontend

```typescript
import { create } from 'zustand';

interface ConsoleState {
  lines: string[];
  pushLine: (line: string) => void;
  clear: () => void;
}

export const useConsoleStore = create<ConsoleState>((set) => ({
  lines: [],
  // Buffer borné à 1000 lignes pour éviter une fuite mémoire sur une session longue
  pushLine: (line) => set((s) => ({ lines: [...s.lines.slice(-999), line] })),
  clear: () => set({ lines: [] }),
}));
```

Utilise `react-window` pour le rendu de la liste de logs : sur un flux continu, un `<div>` avec des centaines de lignes non virtualisées finit par ralentir le re-render à chaque nouvelle ligne.

### 7.6 Notifications & health-check

- Poll `service_status` toutes les 5-10s → si `ActiveState` passe à `failed`, déclenche `tauri-plugin-notification`.
- Health-check de connexion indépendant : un `exec("echo ping")` léger toutes les 15-30s pour détecter une session SSH morte avant que l'utilisateur ne s'en aperçoive en cliquant sur un bouton qui ne répond pas — émet `connection-status: reconnecting` puis retente une connexion avec backoff exponentiel.

## 8. Roadmap par phases

| Phase | Contenu | Definition of Done |
|---|---|---|
| **0 — Setup** | Bootstrap projet, migration VPS vers `systemctl --user`, récupération fingerprint | `npm run tauri dev` lance une fenêtre vide ; VPS répond en `systemctl --user status minecraft` |
| **1 — Couche SSH** | Connexion, auth par clé, TOFU, `ssh_status` | Connexion/déconnexion stable depuis l'UI, fingerprint inconnu bloque et demande confirmation |
| **2 — Contrôle service** | `service_action`, `service_status`, polling | Start/Stop/Restart fonctionnels, statut mis à jour sans reload manuel |
| **3 — Console** | `console_subscribe`, `send_command`, buffer + virtualisation | Logs live visibles, une commande tapée dans l'UI apparaît bien dans le jeu |
| **4 — SFTP** | list/upload/download/rename/delete + validation de chemin + progress | Upload d'un monde de plusieurs centaines de Mo sans freeze UI, barre de progression correcte |
| **5 — Dashboard & UX** | Cards statut, RAM/CPU (`free -h` / `top -bn1` via exec), liste joueurs (parsing `list` ou logs) | Vue d'ensemble lisible en un coup d'œil |
| **6 — Robustesse** | Reconnexion auto, health-check, notifications de crash | App survit à une coupure réseau de 30s sans redémarrage manuel |
| **7 — Tests** | Unitaires Rust + intégration (VPS de test / conteneur) | Suite verte, testée contre un vrai serveur avant chaque release |
| **8 — Packaging** | Icônes, bundle, éventuel auto-update | Binaire installable sur ta machine de dev (Arch/Hyprland) |

## 9. Sécurité — checklist

- [ ] Aucun mot de passe / passphrase en clair dans le store Tauri ou le localStorage front — passe par `keyring`
- [ ] Host key pinning réel (TOFU avec confirmation utilisateur), jamais `Ok(true)` inconditionnel
- [ ] `systemctl --user` privilégié à un sudoers, pour éviter toute élévation de privilège possible depuis l'app
- [ ] Validation stricte de tous les chemins SFTP (pas de `..`, root fixe `/minecraft`)
- [ ] Commandes construites uniquement à partir d'enums / valeurs whitelistées, jamais de string libre interpolée directement dans un `exec`
- [ ] Timeout sur toutes les opérations réseau (connexion, exec, transfert) pour éviter un freeze UI en cas de VPS injoignable
- [ ] Fermeture explicite des channels persistants (tail, sftp) à la déconnexion, pour ne pas laisser de process orphelins sur le VPS

## 10. Stratégie de tests

- **Rust unitaire** : parsing `systemctl show`, échappement des commandes console, validation des chemins SFTP.
- **Intégration** : un conteneur Ubuntu local avec `sshd` + un faux `start.sh` (script bash qui simule des logs et une session `screen`) permet de tester toute la chaîne sans dépendre du vrai VPS ni risquer le serveur de prod pendant le dev.
- **Frontend** : Vitest + Testing Library sur `ConsolePanel` (buffer, ordre d'affichage, envoi de commande) et `FileExplorer` (navigation, upload simulé).
- **Test manuel final** contre le vrai VPS avant chaque release, en particulier le cycle start → commande console → stop.

## 11. Packaging & distribution

- `tauri build` pour ta plateforme de dev (Linux, cohérent avec ton setup Hyprland/Arch habituel) ; ajoute des cibles Windows/macOS seulement si l'app doit tourner ailleurs.
- Icônes via `tauri icon <source.png>`.
- `tauri-plugin-updater` seulement si tu comptes distribuer l'app au-delà de ta machine perso — sinon complexité inutile pour un outil solo.

## 12. Pièges connus à ne pas reproduire

- **Multiplier les connexions SSH** (une par fonctionnalité) au lieu de multiplexer des channels sur une session unique — plus lourd, plus de points de défaillance à gérer côté reconnexion.
- **Appels SSH bloquants sur le thread principal Tauri** — toujours des `#[tauri::command] async fn` avec `russh`/`tokio`, jamais de client SSH synchrone appelé directement (sinon ça gèle l'UI entière le temps de la requête).
- **`tail -f` au lieu de `tail -F`** — casse silencieusement dès que le serveur redémarre et recrée son fichier de log.
- **Channels persistants jamais fermés** — accumulation de process `tail`/sessions orphelines sur le VPS après plusieurs sessions de l'app.
- **`console_subscribe` non-idempotent** — après une reconnexion automatique, si la resouscription au flux de logs n'est pas rejouée, la console reste silencieuse sans erreur visible.
- **Confiance aveugle en `ActiveState=active`** malgré le `Type=forking` sans `PIDFile` — complète avec un health-check applicatif plutôt que de te reposer uniquement sur systemd.

## 13. Évolutions futures (hors V1)

- Support multi-serveurs (plusieurs VPS / instances Minecraft)
- Éditeur de `server.properties` avec validation de schéma
- Gestion whitelist/ops/bans via UI dédiée (lecture/écriture directe des `.json` via SFTP)
- Monitoring TPS/MSPT (nécessite un mod côté serveur type Spark pour Fabric, l'exec SSH seul ne l'expose pas)
- Scheduler de backups intégré, piloté depuis l'UI (cron distant ou timer systemd `--user` dédié)