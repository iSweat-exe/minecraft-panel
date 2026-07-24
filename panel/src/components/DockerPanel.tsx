import React, { useEffect, useState } from 'react';
import { tauriBridge, DockerContainerInfo, DockerImageInfo } from '../lib/tauriBridge';
import { logAction } from '../lib/actionLogger';
import { 
    Play, 
    Square, 
    RotateCw, 
    Trash2, 
    FileText, 
    RefreshCw, 
    Sparkles, 
    Download, 
    Plus, 
    Eye, 
    HardDrive,
    ShieldAlert,
    Settings
} from 'lucide-react';
import { SiDocker } from 'react-icons/si';
import { useToastStore } from '../store/toastStore';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Modal } from './ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/Table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';
import { StatCard } from './ui/StatCard';
import { SearchInput } from './ui/SearchInput';
import { StatusIndicator } from './ui/StatusIndicator';
import { EmptyState } from './ui/EmptyState';
import { Alert } from './ui/Alert';
import { Spinner } from './ui/Spinner';
import { DockerSettingsCard } from './options/DockerSettingsCard';

export const DockerPanel: React.FC = () => {
    const [containers, setContainers] = useState<DockerContainerInfo[]>([]);
    const [images, setImages] = useState<DockerImageInfo[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    
    // Filters & Search
    const [searchContainer, setSearchContainer] = useState<string>('');
    const [searchImage, setSearchImage] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'running' | 'stopped'>('all');
    
    // Modals
    const [logModal, setLogModal] = useState<{ open: boolean; containerName: string; logs: string; loading: boolean }>({
        open: false,
        containerName: '',
        logs: '',
        loading: false,
    });
    
    const [inspectModal, setInspectModal] = useState<{ open: boolean; containerId: string; data: string; loading: boolean }>({
        open: false,
        containerId: '',
        data: '',
        loading: false,
    });

    const [pullModalOpen, setPullModalOpen] = useState<boolean>(false);
    const [pullImageName, setPullImageName] = useState<string>('');
    const [pulling, setPulling] = useState<boolean>(false);

    const [runModalOpen, setRunModalOpen] = useState<boolean>(false);
    const [runForm, setRunForm] = useState({
        image: '',
        name: '',
        ports: '',
        envVars: '',
        restartPolicy: 'unless-stopped',
    });
    const [runningNew, setRunningNew] = useState<boolean>(false);

    // Configuration / Edit Modal State
    const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);
    const [configForm, setConfigForm] = useState<{
        containerId: string;
        image: string;
        originalName: string;
        name: string;
        ports: string;
        envVars: string;
        restartPolicy: string;
    }>({
        containerId: '',
        image: '',
        originalName: '',
        name: '',
        ports: '',
        envVars: '',
        restartPolicy: 'unless-stopped',
    });
    const [savingConfig, setSavingConfig] = useState<boolean>(false);

    const openConfigModal = (container: DockerContainerInfo) => {
        const cleanName = container.names.replace(/^\//, '');
        setConfigForm({
            containerId: container.id,
            image: container.image,
            originalName: cleanName,
            name: cleanName,
            ports: container.ports || '',
            envVars: '',
            restartPolicy: 'unless-stopped',
        });
        setConfigModalOpen(true);
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!configForm.containerId) return;
        setSavingConfig(true);
        try {
            const { nodeUrl, token } = getCredentials();
            const hasPortsOrEnvsChanged = configForm.ports.trim().length > 0 || configForm.envVars.trim().length > 0;

            if (hasPortsOrEnvsChanged) {
                const envArray = configForm.envVars
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);

                await tauriBridge.nodeDockerRecreateContainer(nodeUrl, token, {
                    containerId: configForm.containerId,
                    image: configForm.image,
                    name: configForm.name.trim(),
                    ports: configForm.ports.trim() || undefined,
                    envVars: envArray.length > 0 ? envArray : undefined,
                    restartPolicy: configForm.restartPolicy,
                });
            } else {
                await tauriBridge.nodeDockerUpdateContainer(nodeUrl, token, {
                    containerId: configForm.containerId,
                    newName: configForm.name.trim() !== configForm.originalName ? configForm.name.trim() : undefined,
                    restartPolicy: configForm.restartPolicy,
                });
            }

            addToast({ message: `Conteneur '${configForm.name || configForm.containerId.substring(0, 12)}' mis à jour et redémarré avec succès !`, type: 'success' });
            await logAction(`Configuration du conteneur ${configForm.name || configForm.containerId.substring(0, 8)} mise à jour`, { name: configForm.name, restartPolicy: configForm.restartPolicy });
            setConfigModalOpen(false);
            await fetchAllData();
        } catch (e: any) {
            addToast({ message: `Erreur lors de la mise à jour du conteneur: ${e?.message || e}`, type: 'error' });
        } finally {
            setSavingConfig(false);
        }
    };

    const [confirmDelete, setConfirmDelete] = useState<{ type: 'container' | 'image'; item: DockerContainerInfo | DockerImageInfo } | null>(null);
    const [pruning, setPruning] = useState<boolean>(false);

    const { addToast } = useToastStore();

    const getCredentials = () => {
        const host = localStorage.getItem('node_host');
        const port = localStorage.getItem('node_port') || '8080';
        const token = localStorage.getItem('node_token');
        if (!host || !token) throw new Error("Non connecté au Daemon Node");
        return { nodeUrl: `http://${host}:${port}`, token };
    };

    const fetchAllData = async () => {
        try {
            const { nodeUrl, token } = getCredentials();
            const [containerList, imageList] = await Promise.all([
                tauriBridge.nodeDockerListContainers(nodeUrl, token),
                tauriBridge.nodeDockerListImages(nodeUrl, token).catch(() => []),
            ]);
            setContainers(containerList);
            setImages(imageList);
        } catch (e: any) {
            console.error('Failed to fetch docker data:', e);
            if (e.message !== "Non connecté au Daemon Node") {
                addToast({ message: `Erreur de connexion au Daemon: ${e}`, type: 'error' });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
        const interval = setInterval(fetchAllData, 4000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (containerId: string, action: 'start' | 'stop' | 'restart' | 'remove') => {
        setActionLoading(`${containerId}-${action}`);
        try {
            const { nodeUrl, token } = getCredentials();
            await tauriBridge.nodeDockerContainerAction(nodeUrl, token, containerId, action);
            const targetContainer = containers.find(c => c.id === containerId);
            const name = targetContainer ? targetContainer.names : containerId.substring(0, 12);
            await logAction(`Action '${action}' sur le conteneur Docker ${name}`, { containerId, action });
            addToast({ message: `Action '${action}' exécutée avec succès`, type: 'success' });
            await fetchAllData();
        } catch (e: any) {
            addToast({ message: `Erreur lors de l'action ${action}: ${e?.message || e}`, type: 'error' });
        } finally {
            setActionLoading(null);
            setConfirmDelete(null);
        }
    };

    const handleRemoveImage = async (imageId: string) => {
        setActionLoading(`img-${imageId}-remove`);
        try {
            const { nodeUrl, token } = getCredentials();
            await tauriBridge.nodeDockerRemoveImage(nodeUrl, token, imageId);
            await logAction(`Suppression de l'image Docker ${imageId.substring(0, 12)}`, { imageId });
            addToast({ message: 'Image Docker supprimée avec succès', type: 'success' });
            await fetchAllData();
        } catch (e: any) {
            addToast({ message: `Erreur de suppression d'image: ${e?.message || e}`, type: 'error' });
        } finally {
            setActionLoading(null);
            setConfirmDelete(null);
        }
    };

    const handleSystemPrune = async () => {
        setPruning(true);
        try {
            const { nodeUrl, token } = getCredentials();
            await tauriBridge.nodeDockerSystemPrune(nodeUrl, token);
            await logAction('Nettoyage global système Docker (System Prune)', {});
            addToast({ message: 'Docker nettoyé avec succès ! Images et volumes inutilisés supprimés.', type: 'success' });
            await fetchAllData();
        } catch (e: any) {
            addToast({ message: `Erreur de nettoyage Docker: ${e?.message || e}`, type: 'error' });
        } finally {
            setPruning(false);
        }
    };

    const openLogs = async (containerName: string) => {
        setLogModal({ open: true, containerName, logs: '', loading: true });
        try {
            const { nodeUrl, token } = getCredentials();
            const logs = await tauriBridge.nodeDockerContainerLogs(nodeUrl, token, containerName, 150);
            setLogModal({ open: true, containerName, logs, loading: false });
        } catch (e: any) {
            setLogModal({ open: true, containerName, logs: `Erreur lors de la récupération des logs: ${e}`, loading: false });
        }
    };

    const openInspect = async (containerId: string) => {
        setInspectModal({ open: true, containerId, data: '', loading: true });
        try {
            const { nodeUrl, token } = getCredentials();
            const raw = await tauriBridge.nodeDockerInspectContainer(nodeUrl, token, containerId);
            try {
                const parsed = JSON.parse(raw);
                setInspectModal({ open: true, containerId, data: JSON.stringify(parsed, null, 2), loading: false });
            } catch {
                setInspectModal({ open: true, containerId, data: raw, loading: false });
            }
        } catch (e: any) {
            setInspectModal({ open: true, containerId, data: `Erreur d'inspection: ${e}`, loading: false });
        }
    };

    const handlePullImage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pullImageName.trim()) return;
        setPulling(true);
        try {
            const { nodeUrl, token } = getCredentials();
            await tauriBridge.nodeDockerPullImage(nodeUrl, token, pullImageName.trim());
            await logAction(`Téléchargement de l'image Docker '${pullImageName.trim()}'`, { image: pullImageName.trim() });
            addToast({ message: `Image '${pullImageName}' téléchargée avec succès !`, type: 'success' });
            setPullImageName('');
            setPullModalOpen(false);
            await fetchAllData();
        } catch (e: any) {
            addToast({ message: `Erreur lors du pull d'image: ${e?.message || e}`, type: 'error' });
        } finally {
            setPulling(false);
        }
    };

    const handleRunContainer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!runForm.image.trim()) return;
        setRunningNew(true);
        try {
            const envArray = runForm.envVars
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            const { nodeUrl, token } = getCredentials();
            await tauriBridge.nodeDockerRunContainer(nodeUrl, token, {
                image: runForm.image.trim(),
                name: runForm.name.trim() || undefined,
                ports: runForm.ports.trim() || undefined,
                envVars: envArray.length > 0 ? envArray : undefined,
                restartPolicy: runForm.restartPolicy,
            });

            await logAction(`Lancement d'un nouveau conteneur Docker (${runForm.name.trim() || runForm.image.trim()})`, { image: runForm.image, name: runForm.name });
            addToast({ message: 'Nouveau conteneur Docker démarré !', type: 'success' });
            setRunModalOpen(false);
            setRunForm({ image: '', name: '', ports: '', envVars: '', restartPolicy: 'unless-stopped' });
            await fetchAllData();
        } catch (e: any) {
            addToast({ message: `Erreur lors du lancement du conteneur: ${e?.message || e}`, type: 'error' });
        } finally {
            setRunningNew(false);
        }
    };

    const filteredContainers = containers.filter(c => {
        const matchesSearch = c.names.toLowerCase().includes(searchContainer.toLowerCase()) || 
                              c.image.toLowerCase().includes(searchContainer.toLowerCase()) ||
                              c.id.toLowerCase().includes(searchContainer.toLowerCase());
        
        const isRunning = c.state === 'running';
        if (filterStatus === 'running') return matchesSearch && isRunning;
        if (filterStatus === 'stopped') return matchesSearch && !isRunning;
        return matchesSearch;
    });

    const filteredImages = images.filter(img => {
        return img.repository.toLowerCase().includes(searchImage.toLowerCase()) ||
               img.tag.toLowerCase().includes(searchImage.toLowerCase()) ||
               img.id.toLowerCase().includes(searchImage.toLowerCase());
    });

    const runningCount = containers.filter(c => c.state === 'running').length;
    const stoppedCount = containers.length - runningCount;

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Top Bar / Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-surface border border-border rounded-xl p-5 shadow-lg gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-docker/10 border border-docker/20 rounded-xl text-docker">
                        <SiDocker size={28} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground flex items-center gap-2.5">
                            Gestionnaire Docker
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-docker/10 text-docker border border-docker/20 font-mono font-medium">
                                {containers.length} Conteneurs • {images.length} Images
                            </span>
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Supervisez, créez et contrôlez les conteneurs et images Docker de votre serveur
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <Button
                        onClick={fetchAllData}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        title="Rafraîchir"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        Rafraîchir
                    </Button>

                    <Button
                        onClick={() => setPullModalOpen(true)}
                        variant="secondary"
                        size="sm"
                        className="gap-2"
                    >
                        <Download size={15} />
                        Pull Image
                    </Button>

                    <Button
                        onClick={() => setRunModalOpen(true)}
                        variant="primary"
                        size="sm"
                        className="gap-2"
                    >
                        <Plus size={15} />
                        Créer Conteneur
                    </Button>

                    <Button
                        onClick={handleSystemPrune}
                        disabled={pruning}
                        variant="danger"
                        size="sm"
                        className="gap-2"
                        title="Supprime les conteneurs arrêtés, images orphelines et volumes inutilisés"
                    >
                        <Sparkles size={15} className={pruning ? 'animate-spin' : ''} />
                        {pruning ? 'Nettoyage...' : 'Prune'}
                    </Button>
                </div>
            </div>

            {/* Metrics Quick Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <StatCard
                    title="Total Conteneurs"
                    value={containers.length}
                />
                <StatCard
                    title="En cours d'exécution"
                    value={runningCount}
                    variant={runningCount > 0 ? 'success' : 'default'}
                />
                <StatCard
                    title="Images Docker"
                    value={images.length}
                />
            </div>

            {/* Main Tabs Container */}
            <Tabs defaultValue="containers" className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-4 mb-4">
                    <TabsList>
                        <TabsTrigger value="containers" className="gap-2">
                            <SiDocker size={16} /> Conteneurs ({containers.length})
                        </TabsTrigger>
                        <TabsTrigger value="images" className="gap-2">
                            <HardDrive size={16} /> Images ({images.length})
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="gap-2">
                            <Settings size={16} /> Ressources & Réseau
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* TAB 1: CONTAINERS */}
                <TabsContent value="containers" className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 border border-border rounded-xl overflow-hidden bg-surface flex flex-col min-h-[250px]">
                        {/* Integrated Card Header Toolbar */}
                        <div className="p-3 border-b border-border bg-surface/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                            <SearchInput
                                value={searchContainer}
                                onChange={setSearchContainer}
                                placeholder="Rechercher un conteneur (Nom, Image, ID)..."
                                className="max-w-md"
                            />

                            <div className="flex items-center bg-background border border-border/80 rounded-lg p-1">
                                <button
                                    onClick={() => setFilterStatus('all')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        filterStatus === 'all' ? 'bg-docker/10 text-docker font-semibold' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Tous ({containers.length})
                                </button>
                                <button
                                    onClick={() => setFilterStatus('running')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        filterStatus === 'running' ? 'bg-emerald-500/10 text-emerald-400 font-semibold' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    En cours ({runningCount})
                                </button>
                                <button
                                    onClick={() => setFilterStatus('stopped')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                        filterStatus === 'stopped' ? 'bg-surface-hover text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Arrêtés ({stoppedCount})
                                </button>
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            {loading ? (
                                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm gap-2">
                                    <Spinner size={18} /> Chargement des conteneurs...
                                </div>
                            ) : filteredContainers.length === 0 ? (
                                <EmptyState
                                    icon={SiDocker}
                                    title="Aucun conteneur Docker trouvé"
                                    description="Aucun conteneur ne correspond à vos critères de recherche."
                                />
                            ) : (
                                <Table className="table-fixed w-full">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[30%]">Statut & Nom</TableHead>
                                            <TableHead className="w-[25%]">Image</TableHead>
                                            <TableHead className="w-[15%]">ID</TableHead>
                                            <TableHead className="w-[15%]">Ports</TableHead>
                                            <TableHead className="w-[15%] text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredContainers.map((c) => {
                                            const isRunning = c.state === 'running';
                                            const isRestarting = c.state === 'restarting';
                                            const isMinecraft = c.names.includes('minecraft-panel-server');

                                            return (
                                                <TableRow key={c.id}>
                                                    {/* Status & Name */}
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <StatusIndicator status={isRunning ? 'running' : isRestarting ? 'restarting' : 'stopped'} />
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-foreground flex items-center gap-2 truncate">
                                                                    {c.names.replace(/^\//, '')}
                                                                    {isMinecraft && (
                                                                        <Badge variant="success" className="text-[9px]">
                                                                            Minecraft Panel
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{c.status}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>

                                                    {/* Image */}
                                                    <TableCell className="font-mono text-xs text-foreground/90 truncate" title={c.image}>
                                                        {c.image}
                                                    </TableCell>

                                                    {/* ID */}
                                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                                        {c.id.substring(0, 12)}
                                                    </TableCell>

                                                    {/* Ports */}
                                                    <TableCell className="font-mono text-xs text-muted-foreground truncate" title={c.ports}>
                                                        {c.ports || '-'}
                                                    </TableCell>

                                                    {/* Action Buttons */}
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {/* Logs */}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => openLogs(c.names.replace(/^\//, ''))}
                                                                title="Voir les logs"
                                                                className="h-8 w-8"
                                                            >
                                                                <FileText size={15} />
                                                            </Button>

                                                            {/* Inspect */}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => openInspect(c.id)}
                                                                title="Inspecter la configuration"
                                                                className="h-8 w-8"
                                                            >
                                                                <Eye size={15} />
                                                            </Button>

                                                            {/* Configure */}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => openConfigModal(c)}
                                                                title="Configurer et redémarrer"
                                                                className="h-8 w-8 text-docker hover:bg-docker/10"
                                                            >
                                                                <Settings size={15} />
                                                            </Button>

                                                            {/* Start / Stop */}
                                                            {isRunning ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleAction(c.id, 'stop')}
                                                                    disabled={actionLoading === `${c.id}-stop`}
                                                                    title="Arrêter"
                                                                    className="h-8 w-8 text-warning hover:bg-warning/10"
                                                                >
                                                                    <Square size={15} />
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleAction(c.id, 'start')}
                                                                    disabled={actionLoading === `${c.id}-start`}
                                                                    title="Démarrer"
                                                                    className="h-8 w-8 text-success hover:bg-success/10"
                                                                >
                                                                    <Play size={15} />
                                                                </Button>
                                                            )}

                                                            {/* Restart */}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleAction(c.id, 'restart')}
                                                                disabled={actionLoading === `${c.id}-restart`}
                                                                title="Redémarrer"
                                                                className="h-8 w-8"
                                                            >
                                                                <RotateCw size={15} className={actionLoading === `${c.id}-restart` ? 'animate-spin' : ''} />
                                                            </Button>

                                                            {/* Delete */}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setConfirmDelete({ type: 'container', item: c })}
                                                                title="Supprimer"
                                                                className="h-8 w-8 text-danger hover:bg-danger/10"
                                                            >
                                                                <Trash2 size={15} />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* TAB 2: IMAGES */}
                <TabsContent value="images" className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 border border-border rounded-xl overflow-hidden bg-surface flex flex-col min-h-[250px]">
                        {/* Integrated Card Header Toolbar */}
                        <div className="p-3 border-b border-border bg-surface/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                            <SearchInput
                                value={searchImage}
                                onChange={setSearchImage}
                                placeholder="Rechercher une image (Dépôt, Tag, ID)..."
                                className="max-w-md"
                            />

                            <Button
                                onClick={() => setPullModalOpen(true)}
                                variant="primary"
                                size="sm"
                                className="gap-2"
                            >
                                <Download size={15} /> Télécharger une Image
                            </Button>
                        </div>
                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            {loading ? (
                                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm gap-2">
                                    <Spinner size={18} /> Chargement des images...
                                </div>
                            ) : filteredImages.length === 0 ? (
                                <EmptyState
                                    icon={HardDrive}
                                    title="Aucune image Docker disponible"
                                    description="Téléchargez une image depuis Docker Hub pour lancer vos conteneurs."
                                    action={
                                        <Button size="sm" onClick={() => setPullModalOpen(true)}>
                                            <Download size={14} className="mr-1" /> Pull Image
                                        </Button>
                                    }
                                />
                            ) : (
                                <Table className="table-fixed w-full">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[35%]">Dépôt / Image</TableHead>
                                            <TableHead className="w-[15%]">Tag</TableHead>
                                            <TableHead className="w-[20%]">ID Image</TableHead>
                                            <TableHead className="w-[15%]">Taille</TableHead>
                                            <TableHead className="w-[15%] text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredImages.map((img) => (
                                            <TableRow key={img.id}>
                                                <TableCell className="font-semibold text-foreground">
                                                    {img.repository}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-mono text-[10px]">
                                                        {img.tag}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {img.id.substring(0, 12)}
                                                </TableCell>
                                                <TableCell className="text-xs font-mono text-foreground/90">
                                                    {img.size}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setRunForm(prev => ({ ...prev, image: `${img.repository}:${img.tag}` }));
                                                                setRunModalOpen(true);
                                                            }}
                                                            className="gap-1 text-xs"
                                                            title="Lancer un conteneur avec cette image"
                                                        >
                                                            <Play size={13} /> Lancer
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setConfirmDelete({ type: 'image', item: img })}
                                                            disabled={actionLoading === `img-${img.id}-remove`}
                                                            title="Supprimer l'image"
                                                            className="h-8 w-8 text-danger hover:bg-danger/10"
                                                        >
                                                            <Trash2 size={15} />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* TAB 3: SETTINGS & RESOURCES */}
                <TabsContent value="settings" className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 border border-border rounded-xl overflow-hidden bg-surface flex flex-col min-h-[250px]">
                        <DockerSettingsCard />
                    </div>
                </TabsContent>
            </Tabs>

            {/* MODAL 1: LOGS */}
            <Modal
                isOpen={logModal.open}
                onClose={() => setLogModal({ ...logModal, open: false })}
                title={`Logs de ${logModal.containerName}`}
                maxWidth="max-w-4xl"
            >
                <div className="p-4 bg-black/90 rounded-lg font-mono text-xs text-zinc-300 max-h-[60vh] overflow-y-auto whitespace-pre-wrap leading-relaxed custom-scrollbar">
                    {logModal.loading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Spinner size={16} /> Chargement des récents logs...
                        </div>
                    ) : logModal.logs ? (
                        logModal.logs
                    ) : (
                        <span className="text-zinc-500">Aucun log disponible pour ce conteneur.</span>
                    )}
                </div>
            </Modal>

            {/* MODAL 2: INSPECT */}
            <Modal
                isOpen={inspectModal.open}
                onClose={() => setInspectModal({ ...inspectModal, open: false })}
                title={`Inspection du conteneur ${inspectModal.containerId.substring(0, 12)}`}
                maxWidth="max-w-4xl"
            >
                <div className="p-4 bg-black/90 rounded-lg font-mono text-xs text-emerald-400 max-h-[60vh] overflow-y-auto whitespace-pre-wrap leading-relaxed custom-scrollbar">
                    {inspectModal.loading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Spinner size={16} /> Inspection en cours...
                        </div>
                    ) : (
                        inspectModal.data
                    )}
                </div>
            </Modal>

            {/* MODAL 3: PULL IMAGE */}
            <Modal
                isOpen={pullModalOpen}
                onClose={() => setPullModalOpen(false)}
                title="Télécharger une Image Docker"
                maxWidth="max-w-md"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setPullModalOpen(false)} disabled={pulling}>
                            Annuler
                        </Button>
                        <Button variant="primary" onClick={handlePullImage} disabled={pulling || !pullImageName.trim()}>
                            {pulling ? <Spinner size={16} className="mr-2" /> : <Download size={16} className="mr-2" />}
                            {pulling ? 'Téléchargement...' : 'Télécharger'}
                        </Button>
                    </>
                }
            >
                <form onSubmit={handlePullImage} className="space-y-4">
                    <Alert variant="default" icon>
                        Saisissez le nom complet de l'image (ex: <code className="font-mono">nginx:latest</code>, <code className="font-mono font-bold">itzg/minecraft-server</code>, <code className="font-mono">redis:alpine</code>).
                    </Alert>
                    <div className="space-y-2">
                        <Label htmlFor="image-name">Nom de l'image Docker</Label>
                        <Input
                            id="image-name"
                            value={pullImageName}
                            onChange={(e) => setPullImageName(e.target.value)}
                            placeholder="ex: itzg/minecraft-server:latest"
                            disabled={pulling}
                        />
                    </div>
                </form>
            </Modal>

            {/* MODAL 4: RUN CONTAINER */}
            <Modal
                isOpen={runModalOpen}
                onClose={() => setRunModalOpen(false)}
                title="Créer et Lancer un Conteneur"
                maxWidth="max-w-lg"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setRunModalOpen(false)} disabled={runningNew}>
                            Annuler
                        </Button>
                        <Button variant="primary" onClick={handleRunContainer} disabled={runningNew || !runForm.image.trim()}>
                            {runningNew ? <Spinner size={16} className="mr-2" /> : <Play size={16} className="mr-2" />}
                            {runningNew ? 'Démarrage...' : 'Lancer le conteneur'}
                        </Button>
                    </>
                }
            >
                <form onSubmit={handleRunContainer} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="run-image">Image Docker (*)</Label>
                        <Input
                            id="run-image"
                            value={runForm.image}
                            onChange={(e) => setRunForm({ ...runForm, image: e.target.value })}
                            placeholder="ex: itzg/minecraft-server:latest"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="run-name">Nom du conteneur (optionnel)</Label>
                        <Input
                            id="run-name"
                            value={runForm.name}
                            onChange={(e) => setRunForm({ ...runForm, name: e.target.value })}
                            placeholder="ex: mon-serveur-minecraft"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="run-ports">Ports (séparés par des virgules)</Label>
                        <Input
                            id="run-ports"
                            value={runForm.ports}
                            onChange={(e) => setRunForm({ ...runForm, ports: e.target.value })}
                            placeholder="ex: 25565:25565,8080:80"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="run-envs">Variables d'environnement (séparées par des virgules)</Label>
                        <Input
                            id="run-envs"
                            value={runForm.envVars}
                            onChange={(e) => setRunForm({ ...runForm, envVars: e.target.value })}
                            placeholder="ex: EULA=TRUE, TYPE=PAPER"
                        />
                    </div>
                </form>
            </Modal>

            {/* MODAL 5: CONFIRM DELETE */}
            <Modal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                title={confirmDelete?.type === 'container' ? 'Supprimer le conteneur ?' : "Supprimer l'image Docker ?"}
                maxWidth="max-w-md"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                            Annuler
                        </Button>
                        <Button
                            variant="danger"
                            onClick={() => {
                                if (!confirmDelete) return;
                                if (confirmDelete.type === 'container') {
                                    handleAction((confirmDelete.item as DockerContainerInfo).id, 'remove');
                                } else {
                                    handleRemoveImage((confirmDelete.item as DockerImageInfo).id);
                                }
                            }}
                        >
                            Supprimer définitivement
                        </Button>
                    </>
                }
            >
                <div className="flex items-center gap-3 text-danger mb-2">
                    <ShieldAlert size={24} className="shrink-0" />
                    <p className="text-sm font-semibold">Cette action est irréversible</p>
                </div>
                <p className="text-sm text-muted-foreground">
                    Voulez-vous vraiment supprimer {confirmDelete?.type === 'container' ? 'le conteneur' : "l'image"}{' '}
                    <span className="font-mono font-bold text-foreground">
                        {confirmDelete?.type === 'container'
                            ? (confirmDelete.item as DockerContainerInfo).names.replace(/^\//, '')
                            : `${(confirmDelete?.item as DockerImageInfo)?.repository}:${(confirmDelete?.item as DockerImageInfo)?.tag}`}
                    </span>{' '}
                    ?
                </p>
            </Modal>

            {/* MODAL 6: CONFIGURE CONTAINER */}
            <Modal
                isOpen={configModalOpen}
                onClose={() => setConfigModalOpen(false)}
                title={`Configurer le conteneur ${configForm.originalName}`}
                maxWidth="max-w-lg"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setConfigModalOpen(false)} disabled={savingConfig}>
                            Annuler
                        </Button>
                        <Button variant="primary" onClick={handleSaveConfig} disabled={savingConfig}>
                            {savingConfig ? <Spinner size={16} className="mr-2" /> : <RotateCw size={16} className="mr-2" />}
                            {savingConfig ? 'Mise à jour...' : 'Enregistrer et Redémarrer'}
                        </Button>
                    </>
                }
            >
                <form onSubmit={handleSaveConfig} className="space-y-4">
                    <Alert variant="warning" icon>
                        L'enregistrement de la nouvelle configuration entraînera le <strong>redémarrage automatique</strong> du conteneur pour appliquer vos modifications.
                    </Alert>

                    <div className="space-y-2">
                        <Label htmlFor="cfg-name">Nom du conteneur</Label>
                        <Input
                            id="cfg-name"
                            value={configForm.name}
                            onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                            placeholder="ex: mon-serveur-minecraft"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cfg-restart">Politique de redémarrage (Restart Policy)</Label>
                        <select
                            id="cfg-restart"
                            value={configForm.restartPolicy}
                            onChange={(e) => setConfigForm({ ...configForm, restartPolicy: e.target.value })}
                            className="w-full h-10 px-3 rounded-lg bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-docker/50"
                        >
                            <option value="unless-stopped">unless-stopped (Recommandé)</option>
                            <option value="always">always (Toujours)</option>
                            <option value="on-failure">on-failure (En cas d'erreur)</option>
                            <option value="no">no (Jamais)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cfg-ports">Ports (séparés par des virgules)</Label>
                        <Input
                            id="cfg-ports"
                            value={configForm.ports}
                            onChange={(e) => setConfigForm({ ...configForm, ports: e.target.value })}
                            placeholder="ex: 25565:25565,8080:80"
                        />
                        <span className="text-[11px] text-muted-foreground block">
                            Note: La modification des ports recréera le conteneur avec les nouveaux ports.
                        </span>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cfg-envs">Variables d'environnement (séparées par des virgules)</Label>
                        <Input
                            id="cfg-envs"
                            value={configForm.envVars}
                            onChange={(e) => setConfigForm({ ...configForm, envVars: e.target.value })}
                            placeholder="ex: EULA=TRUE, TYPE=PAPER"
                        />
                    </div>
                </form>
            </Modal>
        </div>
    );
};
