# Vision du Projet : VPS Panel Daemon

Ce document définit l'âme, l'ambition et les principes directeurs du daemon de VPS Panel. Il sert de guide pour les décisions architecturales et l'ajout de nouvelles fonctionnalités.

## 1. La Mission Principale
Créer un panel de gestion **complet, moderne, propre et maintenable** pour VPS, destiné à devenir une alternative Open Source solide. 

Le but ultime est que ce daemon puisse propulser un frontend complet (développé séparément) capable de :
- Gérer et monitorer des instances et conteneurs (via Docker)
- Gérer et monitorer Docker globalement.
- Permettre un accès complet aux fichiers (SFTP, API).
- Fournir un terminal distant root au VPS.
- Gérer les permissions et rôles des utilisateurs de façon granulaire.
- Exécuter des tâches planifiées (Backups, scripts, automatisations).

## 2. Le Public Cible et le Scope (1 Panel = 1 VPS)
Le projet s'adresse principalement à la **communauté Open Source** :
- Les administrateurs systèmes, les passionnés et les joueurs cherchant une solution propre et légère pour héberger et gérer leurs propres serveurs sur une machine dédiée.
- **Scope défini :** Contrairement à Pterodactyl qui est multi-nodes, la vision ici est **1 Panel -> 1 Daemon -> 1 VPS**. La base de données locale (SQLite) gère elle-même ses utilisateurs car le daemon est pensé pour vivre en autarcie sur sa machine hôte. Il n'a pas vocation à devenir une usine à gaz multi-serveurs distribuée.
- Les petites et moyennes communautés qui trouvent Pterodactyl trop complexe, trop lourd ou "overkill" pour leurs besoins.
- Bien qu'il vise à concurrencer des solutions massives dans l'idéal, sa conception "core" est pensée pour l'utilisateur indépendant.

## 3. La Philosophie : Simplicité Absolue ("Plug & Play")
- **Zéro prise de tête** : L'utilisateur doit simplement exécuter le daemon sur son VPS pour que l'API et la gestion démarrent.
- **Configuration optionnelle** : Les configurations (comme le changement de port, la personnalisation des secrets) doivent rester *facultatives*. Par défaut, le daemon doit fonctionner immédiatement avec des paramètres sécurisés générés automatiquement.
- **Batteries included** : La base de données (SQLite) et le système d'authentification sont intégrés directement. Pas besoin de monter un MySQL externe ou un serveur Redis pour commencer.

## 4. Ce que le projet NE DOIT PAS devenir (Anti-Goals)
Afin de préserver la propreté du code et d'éviter le "feature creep" (dérive des fonctionnalités) :
- **Un système de facturation ou un CRM commercial** : Le panel restera focalisé sur l'aspect *technique* de la gestion de serveurs (monitoring, fichiers, processus), et n'inclura pas de modules WHMCS-like ou de paiement.
- **Un monolithe inséparable** : Le daemon API et l'interface utilisateur (frontend) sont et doivent rester strictement séparés. Le daemon doit rester "headless".
- **Un "usine à gaz" bloquante** : Les dépendances lourdes (ex: obligation d'avoir Kubernetes, ou d'autres services externes) sont bannies.

## 5. Décisions Techniques et Architecture

### Pourquoi Rust ?
- **Performance et Empreinte Mémoire** : Contrairement aux daemons Node.js ou PHP, un binaire Rust consomme extrêmement peu de RAM et de CPU, laissant 100% de la puissance de la machine pour les serveurs de jeu.
- **Sécurité et Stabilité** : La gestion de la mémoire par le compilateur évite les crashs intempestifs. Un daemon ne doit *jamais* planter.
- **Maintenabilité** : Le typage strict permet de refactoriser sans casser silencieusement des fonctionnalités (comme le passage à l'API v1).

### Pourquoi Axum ?
- C'est un framework web moderne, soutenu par l'équipe de `tokio`, qui offre des performances exceptionnelles et un routage ergonomique (notamment pour gérer facilement les WebSockets nécessaires aux terminaux interactifs).

### Pourquoi Docker ?
- L'isolation est primordiale. L'utilisation de l'API Docker permet d'imposer des limites de ressources (CPU, RAM) à chaque serveur, d'éviter les conflits de ports, et d'assurer une suppression propre sans résidus sur l'hôte.

### Pistes d'amélioration futures pour l'architecture :
- Mise en place d'un système de plugins (via WebAssembly, par exemple) pour étendre les capacités du daemon sans modifier le code source core.
- Migration vers des gRPC/Protobuf optionnels pour la communication inter-noeuds si l'ambition "multi-nodes" émerge.
- Mise en place d'un protocole SFTP natif intégré au binaire Rust (sans avoir à dépendre du démon SSH de l'hôte), afin d'avoir les permissions alignées avec la base SQLite interne.
