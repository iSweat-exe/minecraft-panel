import React from 'react';
import { Users, Globe, Shield, FileText, Server, Terminal, Settings, MessageSquare, Cpu } from 'lucide-react';
import { ServerProps } from '../../hooks/useServerOptions';

interface PropertiesFormProps {
    properties: ServerProps;
    updateProp: (key: string, value: string) => void;
}

const InputBox = ({ label, description, propKey, type = "text", icon: Icon, properties, updateProp }: { label: string, description?: string, propKey: string, type?: string, icon?: any, properties: any, updateProp: (k: string, v: string) => void }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col justify-between focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all h-full">
        <div className="p-3 flex justify-between items-start bg-zinc-900/50 border-b border-zinc-800 flex-1">
            <div>
                <div className="font-semibold text-zinc-200 text-[14px]">{label}</div>
                {description && <div className="text-zinc-500 text-[11px] mt-1 leading-snug pr-2">{description}</div>}
            </div>
            <div className="text-zinc-600 font-mono text-[10px] shrink-0 mt-0.5">{propKey}</div>
        </div>
        <div className="px-3 py-2 flex items-center bg-zinc-950 shrink-0 min-h-[46px]">
            {Icon && <div className="p-1.5 bg-zinc-900 rounded border border-zinc-800 mr-3"><Icon size={16} className="text-zinc-400" /></div>}
            <input 
                type={type} 
                value={properties[propKey] || ''}
                onChange={(e) => updateProp(propKey, e.target.value)}
                className={`w-full bg-transparent border-0 text-zinc-100 font-mono text-sm focus:outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${!Icon ? 'px-1' : ''}`}
            />
        </div>
    </div>
);

const SelectBox = ({ label, description, propKey, options, properties, updateProp }: { label: string, description?: string, propKey: string, options: { value: string, label: string }[], properties: any, updateProp: (k: string, v: string) => void }) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col justify-between focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all h-full">
        <div className="p-3 flex justify-between items-start bg-zinc-900/50 border-b border-zinc-800 flex-1">
            <div>
                <div className="font-semibold text-zinc-200 text-[14px]">{label}</div>
                {description && <div className="text-zinc-500 text-[11px] mt-1 leading-snug pr-2">{description}</div>}
            </div>
            <div className="text-zinc-600 font-mono text-[10px] shrink-0 mt-0.5">{propKey}</div>
        </div>
        <div className="px-3 py-2 bg-zinc-950 flex items-center shrink-0 min-h-[46px]">
            <select 
                value={properties[propKey] || ''}
                onChange={(e) => updateProp(propKey, e.target.value)}
                className="w-full bg-transparent border-0 text-zinc-100 font-mono text-sm focus:outline-none focus:ring-0 p-0 cursor-pointer"
            >
                {options.map(opt => <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-100">{opt.label}</option>)}
            </select>
        </div>
    </div>
);

const ToggleBox = ({ label, description, propKey, inverted = false, properties, updateProp }: { label: string, description?: string, propKey: string, inverted?: boolean, properties: any, updateProp: (k: string, v: string) => void }) => {
    let isTrue = properties[propKey] === 'true';
    if (inverted) isTrue = !isTrue;

    const toggle = () => {
        let nextVal = isTrue ? 'false' : 'true';
        if (inverted) nextVal = nextVal === 'true' ? 'false' : 'true';
        updateProp(propKey, nextVal);
    };

    return (
        <div 
            className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col justify-between cursor-pointer group hover:border-zinc-700 transition-colors h-full"
            onClick={toggle}
        >
            <div className="p-3 flex justify-between items-start bg-zinc-900/50 border-b border-zinc-800 group-hover:bg-zinc-800/30 transition-colors flex-1">
                <div>
                    <div className="font-semibold text-zinc-200 text-[14px]">{label}</div>
                    {description && <div className="text-zinc-500 text-[11px] mt-1 leading-snug pr-2">{description}</div>}
                </div>
                <div className="text-zinc-600 font-mono text-[10px] shrink-0 mt-0.5">{propKey}</div>
            </div>
            <div className="px-4 py-2 bg-zinc-950 flex justify-between items-center group-hover:bg-zinc-900/30 transition-colors shrink-0 min-h-[46px]">
                <span className="text-sm font-medium text-zinc-400">
                    {isTrue ? 'Activé' : 'Désactivé'}
                </span>
                <button 
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        isTrue ? 'bg-indigo-500' : 'bg-zinc-700'
                    }`}
                >
                    <span 
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            isTrue ? 'translate-x-5' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>
        </div>
    );
};

const Section = ({ title, icon: Icon, children, className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" }: { title: string, icon: any, children: React.ReactNode, className?: string }) => (
    <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/50">
            <Icon className="text-indigo-400" size={18} />
            <h3 className="text-md font-medium text-zinc-200">{title}</h3>
        </div>
        <div className={className}>
            {children}
        </div>
    </div>
);

export const PropertiesForm: React.FC<PropertiesFormProps> = ({ properties, updateProp }) => {
    return (
        <div className="space-y-8 pb-10">
            <Section title="Serveur & Réseau" icon={Server}>
                <InputBox label="IP du Serveur" description="L'adresse IP sur laquelle le serveur écoute. Laissez vide pour écouter sur toutes les interfaces." propKey="server-ip" type="text" properties={properties} updateProp={updateProp} />
                <InputBox label="Port du Serveur" description="Le port réseau du serveur (par défaut: 25565)." propKey="server-port" type="number" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Statut du Serveur" description="Permet au serveur d'apparaître comme 'en ligne' dans la liste des serveurs multijoueurs." propKey="enable-status" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Cacher Joueurs en ligne" description="Cache la liste des joueurs connectés lors du ping du serveur." propKey="hide-online-players" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Accepter Transferts" description="Autorise le serveur à accepter les transferts de joueurs depuis d'autres serveurs (ex: BungeeCord)." propKey="accepts-transfers" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Anti-Proxy" description="Si activé, bloque les joueurs utilisant un VPN ou un proxy." propKey="prevent-proxy-connections" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Transport Natif" description="Améliore les performances réseau sous Linux (epoll)." propKey="use-native-transport" properties={properties} updateProp={updateProp} />
                <InputBox label="Seuil Compression" description="Taille (en octets) à partir de laquelle les paquets réseau sont compressés (-1 pour désactiver)." propKey="network-compression-threshold" type="number" properties={properties} updateProp={updateProp} />
            </Section>

            <Section title="Joueurs & Combat" icon={Users}>
                <InputBox label="Nombre de joueurs" description="Nombre maximum de joueurs pouvant se connecter simultanément." propKey="max-players" type="number" icon={Users} properties={properties} updateProp={updateProp} />
                <SelectBox label="Mode de jeu" description="Mode de jeu par défaut pour les nouveaux joueurs." propKey="gamemode" options={[
                    { value: 'survival', label: 'Survie' },
                    { value: 'creative', label: 'Créatif' },
                    { value: 'adventure', label: 'Aventure' },
                    { value: 'spectator', label: 'Spectateur' }
                ]} properties={properties} updateProp={updateProp} />
                <SelectBox label="Difficulté" description="Niveau de difficulté (dégâts, faim, monstres)." propKey="difficulty" options={[
                    { value: 'peaceful', label: 'Paisible' },
                    { value: 'easy', label: 'Facile' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'hard', label: 'Difficile' }
                ]} properties={properties} updateProp={updateProp} />
                <ToggleBox label="Mode Hardcore" description="Si un joueur meurt, il est banni/spectateur définitivement." propKey="hardcore" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Forcer le mode de jeu" description="Force les joueurs à rejoindre avec le mode de jeu par défaut." propKey="force-gamemode" properties={properties} updateProp={updateProp} />
                <ToggleBox label="PvP" description="Autorise les joueurs à se blesser entre eux." propKey="pvp" properties={properties} updateProp={updateProp} />
                <InputBox label="Temps inactivité max" description="Exclut automatiquement les joueurs inactifs après X minutes (0 = désactivé)." propKey="player-idle-timeout" type="number" properties={properties} updateProp={updateProp} />
                <InputBox label="Pause si vide (sec)" description="Met le serveur en pause (ne tick plus) s'il n'y a personne." propKey="pause-when-empty-seconds" type="number" properties={properties} updateProp={updateProp} />
                <InputBox label="Portée Entity Broadcast" description="Distance d'affichage des entités par rapport au défaut (en %)." propKey="entity-broadcast-range-percentage" type="number" properties={properties} updateProp={updateProp} />
            </Section>

            <Section title="Sécurité & Accès" icon={Shield}>
                <ToggleBox label="Liste blanche" description="Seuls les joueurs ajoutés à la whitelist peuvent rejoindre." propKey="white-list" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Forcer Liste blanche" description="Exclut les joueurs en ligne s'ils sont retirés de la whitelist." propKey="enforce-whitelist" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Cracké (Offline)" description="Active ou désactive les comptes crackés." propKey="online-mode" inverted={true} properties={properties} updateProp={updateProp} />
                <ToggleBox label="Forcer Profil Sécurisé" description="Exige une clé publique valide signée par Mojang (bloque certains mods chat)." propKey="enforce-secure-profile" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Vol autorisé" description="Autorise le vol (désactive le kick anti-vol natif)." propKey="allow-flight" properties={properties} updateProp={updateProp} />
                <InputBox label="Niveau OP" description="Niveau de permissions par défaut des opérateurs (1 à 4)." propKey="op-permission-level" type="number" properties={properties} updateProp={updateProp} />
                <InputBox label="Niveau Fonction" description="Niveau de permission pour l'exécution des fonctions (datapacks)." propKey="function-permission-level" type="number" properties={properties} updateProp={updateProp} />
            </Section>

            <Section title="Monde & Génération" icon={Globe}>
                <InputBox label="Nom du monde" description="Le nom du dossier contenant le monde." propKey="level-name" type="text" properties={properties} updateProp={updateProp} />
                <InputBox label="Type de monde" description="Type de génération (ex: default, flat, largeBiomes)." propKey="level-type" type="text" properties={properties} updateProp={updateProp} />
                <InputBox label="Graine (Seed)" description="La graine utilisée pour générer le monde." propKey="level-seed" type="text" properties={properties} updateProp={updateProp} />
                <InputBox label="Distance de vue" description="Distance d'affichage (chunks) envoyée aux joueurs (impact perf)." propKey="view-distance" type="number" properties={properties} updateProp={updateProp} />
                <InputBox label="Distance Simulation" description="Distance (chunks) de mise à jour des entités/fours (impact perf)." propKey="simulation-distance" type="number" properties={properties} updateProp={updateProp} />
                <InputBox label="Protection du spawn" description="Rayon (blocs) du spawn protégé des destructions (0 = désactivé)." propKey="spawn-protection" type="number" icon={Shield} properties={properties} updateProp={updateProp} />
                <ToggleBox label="Générer Structures" description="Active la génération des villages, donjons, etc." propKey="generate-structures" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Synchro Chunk Writes" description="Écrit les chunks de manière synchrone (plus sûr mais plus lent)." propKey="sync-chunk-writes" properties={properties} updateProp={updateProp} />
                <InputBox label="Taille max monde" description="Rayon maximum du monde (bordure automatique)." propKey="max-world-size" type="number" properties={properties} updateProp={updateProp} />
                <div className="md:col-span-2 lg:col-span-3">
                    <InputBox label="Paramètres Générateur" description="Paramètres JSON pour la génération de mondes personnalisés." propKey="generator-settings" type="text" properties={properties} updateProp={updateProp} />
                </div>
            </Section>

            <Section title="RCON & Query" icon={Terminal}>
                <ToggleBox label="Activer RCON" description="Active le protocole RCON pour l'exécution de commandes." propKey="enable-rcon" properties={properties} updateProp={updateProp} />
                <InputBox label="Port RCON" description="Port utilisé pour la connexion RCON." propKey="rcon.port" type="number" properties={properties} updateProp={updateProp} />
                <InputBox label="Mot de passe RCON" description="Mot de passe requis pour s'authentifier." propKey="rcon.password" type="text" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Broadcast RCON (OP)" description="Envoie le résultat RCON à tous les OP en ligne." propKey="broadcast-rcon-to-ops" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Activer Query" description="Active GameSpy4 (Query) pour lister les infos du serveur." propKey="enable-query" properties={properties} updateProp={updateProp} />
                <InputBox label="Port Query" description="Port UDP utilisé pour le Query." propKey="query.port" type="number" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Broadcast Console (OP)" description="Envoie les commandes console aux OP en ligne." propKey="broadcast-console-to-ops" properties={properties} updateProp={updateProp} />
            </Section>

            <Section title="Chat & Filtres" icon={MessageSquare}>
                <ToggleBox label="Activer Code Conduite" description="Invite les joueurs à accepter les règles." propKey="enable-code-of-conduct" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Logs IP" description="Enregistre les IPs dans la console (RGPD)." propKey="log-ips" properties={properties} updateProp={updateProp} />
                <InputBox label="Seuil Spam Chat" description="Intervalle (sec) minimum entre les messages." propKey="chat-spam-threshold-seconds" type="number" properties={properties} updateProp={updateProp} />
                <InputBox label="Seuil Spam Commandes" description="Intervalle (sec) minimum entre les commandes." propKey="command-spam-threshold-seconds" type="number" properties={properties} updateProp={updateProp} />
                <div className="md:col-span-2">
                    <InputBox label="Config Filtre Texte" description="Configuration pour le filtre de contenu (injures)." propKey="text-filtering-config" type="text" properties={properties} updateProp={updateProp} />
                </div>
                <InputBox label="Version Filtre" description="Version du filtre de texte." propKey="text-filtering-version" type="number" properties={properties} updateProp={updateProp} />
            </Section>

            <Section title="Avancé & Performance" icon={Cpu}>
                <InputBox label="Temps Tick Max" description="Temps (ms) avant crash du serveur s'il freeze (-1 = désactivé)." propKey="max-tick-time" type="number" properties={properties} updateProp={updateProp} />
                <InputBox label="Limite Requêtes" description="Max requêtes réseau par IP (0 = désactivé)." propKey="rate-limit" type="number" properties={properties} updateProp={updateProp} />
                <InputBox label="Max Neighbor Updates" description="Limite de mises à jour en chaîne (évite crash redstone)." propKey="max-chained-neighbor-updates" type="number" properties={properties} updateProp={updateProp} />
                <SelectBox label="Compression Régions" description="Algorithme de compression des sauvegardes." propKey="region-file-compression" options={[
                    { value: 'deflate', label: 'Deflate' },
                    { value: 'lz4', label: 'LZ4' },
                    { value: 'none', label: 'Aucune' }
                ]} properties={properties} updateProp={updateProp} />
                <InputBox label="Interval Heartbeat" description="Temps (ms) entre chaque rapport d'état." propKey="status-heartbeat-interval" type="number" properties={properties} updateProp={updateProp} />
                <ToggleBox label="Monitoring JMX" description="Active les métriques JMX (JVM)." propKey="enable-jmx-monitoring" properties={properties} updateProp={updateProp} />
                <div className="md:col-span-2 lg:col-span-3 xl:col-span-4">
                    <InputBox label="Lien rapport bug" description="Lien affiché lors d'un crash client." propKey="bug-report-link" type="text" properties={properties} updateProp={updateProp} />
                </div>
            </Section>

            <Section title="Pack de Ressources" icon={FileText}>
                <ToggleBox label="Pack de ressources requis" description="Force l'acceptation du pack pour jouer." propKey="require-resource-pack" properties={properties} updateProp={updateProp} />
                <div className="md:col-span-2">
                    <InputBox label="URL du pack de Ressources" description="URL directe (.zip)." propKey="resource-pack" type="text" properties={properties} updateProp={updateProp} />
                </div>
                <div className="md:col-span-2">
                    <InputBox label="Message du pack" description="Affiché aux joueurs lors de la demande." propKey="resource-pack-prompt" type="text" properties={properties} updateProp={updateProp} />
                </div>
                <InputBox label="Pack ID" description="Identifiant (UUID) du pack." propKey="resource-pack-id" type="text" properties={properties} updateProp={updateProp} />
                <InputBox label="Pack SHA1" description="Hash SHA-1 du fichier (vérification intégrité)." propKey="resource-pack-sha1" type="text" properties={properties} updateProp={updateProp} />
                <div className="md:col-span-2 lg:col-span-4">
                    <InputBox label="Packs activés (initial)" description="Datapacks activés par défaut (ex: vanilla)." propKey="initial-enabled-packs" type="text" properties={properties} updateProp={updateProp} />
                </div>
                <div className="md:col-span-2 lg:col-span-4">
                    <InputBox label="Packs désactivés (initial)" description="Datapacks désactivés par défaut." propKey="initial-disabled-packs" type="text" properties={properties} updateProp={updateProp} />
                </div>
            </Section>
            
            <Section title="Serveur de Management (Avancé)" icon={Settings}>
                <ToggleBox label="Activer Management" description="Active le serveur de management Mojang." propKey="management-server-enabled" properties={properties} updateProp={updateProp} />
                <ToggleBox label="TLS Management" description="Active le chiffrement TLS." propKey="management-server-tls-enabled" properties={properties} updateProp={updateProp} />
                <InputBox label="Hôte Management" description="Interface réseau." propKey="management-server-host" type="text" properties={properties} updateProp={updateProp} />
                <InputBox label="Port Management" description="Port d'écoute." propKey="management-server-port" type="number" properties={properties} updateProp={updateProp} />
                <div className="md:col-span-2">
                    <InputBox label="Secret Management" description="Secret partagé (token) d'authentification." propKey="management-server-secret" type="password" properties={properties} updateProp={updateProp} />
                </div>
                <div className="md:col-span-2 lg:col-span-4">
                    <InputBox label="Keystore TLS" description="Chemin vers le certificat TLS." propKey="management-server-tls-keystore" type="text" properties={properties} updateProp={updateProp} />
                </div>
                <div className="md:col-span-2 lg:col-span-4">
                    <InputBox label="Keystore Password" description="Mot de passe du certificat TLS." propKey="management-server-tls-keystore-password" type="password" properties={properties} updateProp={updateProp} />
                </div>
                <div className="md:col-span-2 lg:col-span-4">
                    <InputBox label="Origines Autorisées" description="URL d'origines autorisées (CORS)." propKey="management-server-allowed-origins" type="text" properties={properties} updateProp={updateProp} />
                </div>
            </Section>
        </div>
    );
};
