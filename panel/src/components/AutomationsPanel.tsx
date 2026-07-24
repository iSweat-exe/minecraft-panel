import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Clock, Plus, Trash2, Power, Download, Save, TriangleAlert, Info } from 'lucide-react';
import { tauriBridge } from '../lib/tauriBridge';
import { useToastStore } from '../store/toastStore';
import { ConfirmDialog } from './dialogs/ConfirmDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select';
import { logAction } from '../lib/actionLogger';
import { useActiveServerStore } from '../store/activeServerStore';

type JobType = 'restart' | 'start' | 'stop' | 'backup' | 'clean_backups' | 'clean_logs' | 'custom';

interface CronJob {
    id: string;
    type: JobType;
    cronExp: string;
    command: string;
    rawLine: string;
}



export const AutomationsPanel: React.FC = () => {
    const [jobs, setJobs] = useState<CronJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [newJobType, setNewJobType] = useState<JobType>('restart');
    const [newJobTime, setNewJobTime] = useState('04:00');

    const [servers, setServers] = useState<{id: string, name: string}[]>([]);
    const activeServerId = useActiveServerStore(state => state.activeServerId);
    const [selectedServer, setSelectedServer] = useState<string>(activeServerId || 'mc-server-default');

    useEffect(() => {
        loadCrontab();
        fetchServers();
    }, []);

    const fetchServers = async () => {
        try {
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            if (!host || !token) return;
            const nodeUrl = `http://${host}:${port}`;
            
            const list = await tauriBridge.nodeListServers(nodeUrl, token);
            setServers(list.map(s => ({ id: s.server_id, name: s.name })));
            if (list.length > 0 && !activeServerId) {
                setSelectedServer(list[0].server_id);
            }
        } catch(e) {
            console.error("Failed to fetch servers", e);
        }
    };

    const loadCrontab = async () => {
        setLoading(true);
        try {
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            if (!host || !token) return;
            const nodeUrl = `http://${host}:${port}`;

            const res = await tauriBridge.nodeApiRequest(nodeUrl, token, 'GET', '/api/automations');
            if (res?.success && Array.isArray(res.data)) {
                const parsedJobs: CronJob[] = res.data.map((job: any) => ({
                    id: job.id,
                    type: job.action_type as JobType,
                    cronExp: job.cron_expr,
                    command: `Serveur: ${job.target_server || 'Global'}`,
                    rawLine: `ID: ${job.id}`
                }));
                setJobs(parsedJobs);
            } else {
                setJobs([]);
            }
        } catch (err: any) {
            console.error("Failed to load automations:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddJob = async () => {
        const [hours, minutes] = newJobTime.split(':');
        const cronExp = `${minutes} ${hours} * * *`;
        
        try {
            const host = localStorage.getItem('node_host');
            const port = localStorage.getItem('node_port') || '8080';
            const token = localStorage.getItem('node_token');
            if (!host || !token) throw new Error("Daemon credentials missing");
            const nodeUrl = `http://${host}:${port}`;

            const payload = {
                name: `Tâche ${newJobType}`,
                cron_expr: cronExp,
                action_type: newJobType,
                target_server: (newJobType === 'backup' || newJobType.startsWith('clean_')) ? null : selectedServer,
                payload: null
            };

            await tauriBridge.nodeApiRequest(nodeUrl, token, 'POST', '/api/automations', payload);
            
            await loadCrontab();
            logAction('Ajout d\'une tâche planifiée', { type: newJobType, time: newJobTime });
            
            setIsEditing(false);
            useToastStore.getState().addToast({ type: 'success', message: 'Tâche créée' });
        } catch (err) {
            console.error(err);
            useToastStore.getState().addToast({ type: 'error', message: 'Erreur lors de la création de la tâche' });
        }
    };

    const handleDeleteJob = async (id: string) => {
        const ok = await ConfirmDialog.call({ message: 'Êtes-vous sûr de vouloir supprimer cette tâche planifiée ?' });
        if (ok) {
            try {
                const host = localStorage.getItem('node_host');
                const port = localStorage.getItem('node_port') || '8080';
                const token = localStorage.getItem('node_token');
                if (!host || !token) throw new Error("Daemon credentials missing");
                const nodeUrl = `http://${host}:${port}`;

                await tauriBridge.nodeApiRequest(nodeUrl, token, 'DELETE', `/api/automations/${id}`);
                
                const job = jobs.find(j => j.id === id);
                await loadCrontab();
                if (job) {
                    logAction('Suppression d\'une tâche planifiée', { type: job.type });
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    const parseCronTimeToText = (cronExp: string) => {
        const parts = cronExp.split(' ');
        if (parts.length >= 5) {
            const min = parts[0].padStart(2, '0');
            const hour = parts[1].padStart(2, '0');
            if (!hour.includes('*') && !min.includes('*')) {
                return `Tous les jours à ${hour}:${min}`;
            }
        }
        return `Cron: ${cronExp}`;
    };

    return (
        <Card className="flex flex-col h-full bg-background/50 p-6 border-border/50 shadow-none overflow-y-auto custom-scrollbar">
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Clock className="text-primary" />
                        Automatisations
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Programmez des tâches automatiques sur votre serveur (Cron jobs).
                    </p>
                </div>
                {!isEditing && (
                    <Button onClick={() => setIsEditing(true)} className="flex items-center gap-2">
                        <Plus size={16} /> Nouvelle tâche
                    </Button>
                )}
            </div>

            {isEditing && (
                <Card className="p-5 bg-surface/50 border border-primary/20 mb-6">
                    <h3 className="font-semibold text-foreground mb-4">Créer une tâche planifiée</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-muted-foreground">Type d'action</label>
                            <Select 
                                value={newJobType}
                                onValueChange={(val) => setNewJobType(val as JobType)}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Sélectionnez une action" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="restart">Redémarrage du serveur</SelectItem>
                                    <SelectItem value="start">Démarrage du serveur</SelectItem>
                                    <SelectItem value="stop">Arrêt du serveur</SelectItem>
                                    <SelectItem value="backup">Sauvegarde complète (SFTP)</SelectItem>
                                    <SelectItem value="clean_backups">Nettoyage des vieilles sauvegardes (&gt; 7 jours)</SelectItem>
                                    <SelectItem value="clean_logs">Nettoyage des vieux logs (&gt; 7 jours)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {(newJobType === 'restart' || newJobType === 'start' || newJobType === 'stop') && (
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Serveur Cible (Conteneur)</label>
                                {servers.length > 0 ? (
                                    <Select 
                                        value={selectedServer}
                                        onValueChange={(val) => setSelectedServer(val)}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Sélectionnez un serveur" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {servers.map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.name} ({s.id})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <input 
                                        type="text" 
                                        className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                        value={selectedServer}
                                        onChange={e => setSelectedServer(e.target.value)}
                                        placeholder="ID du conteneur (ex: mc-server-default)"
                                    />
                                )}
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-muted-foreground">Heure d'exécution (Quotidien)</label>
                            <input 
                                type="time" 
                                className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                value={newJobTime}
                                onChange={e => setNewJobTime(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-surface rounded-md border border-border/50 mb-5 text-sm text-muted-foreground">
                        <Info size={16} className="shrink-0 text-primary mt-0.5" />
                        <p>
                            {newJobType === 'restart' && "Le serveur s'éteindra et se rallumera proprement à l'heure indiquée."}
                            {newJobType === 'start' && "Le serveur s'allumera à l'heure indiquée s'il était éteint."}
                            {newJobType === 'stop' && "Le serveur s'éteindra proprement à l'heure indiquée."}
                            {newJobType === 'backup' && "Une archive .tar.gz de tout le serveur sera créée dans ~/minecraft_backups/. Assurez-vous d'avoir assez d'espace disque sur le VPS !"}
                            {newJobType === 'clean_backups' && "Les sauvegardes datant de plus de 7 jours seront automatiquement supprimées pour libérer de l'espace."}
                            {newJobType === 'clean_logs' && "Les vieux fichiers journaux compressés (.log.gz) datant de plus de 7 jours seront supprimés."}
                        </p>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsEditing(false)}>Annuler</Button>
                        <Button onClick={handleAddJob} className="flex items-center gap-2">
                            <Save size={16} /> Enregistrer
                        </Button>
                    </div>
                </Card>
            )}

            <div className="space-y-3">
                {loading ? (
                    <div className="text-sm text-muted-foreground animate-pulse">Chargement des tâches...</div>
                ) : jobs.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground border border-dashed border-border/50 rounded-xl bg-surface/20">
                        <Clock size={32} className="mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Aucune tâche automatique programmée.</p>
                    </div>
                ) : (
                    jobs.map(job => (
                        <div key={job.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/40 bg-surface/20">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    {job.type === 'restart' ? <Power size={18} /> : 
                                     job.type === 'start' ? <Power size={18} className="text-success" /> : 
                                     job.type === 'stop' ? <Power size={18} className="text-danger" /> : 
                                     job.type === 'backup' ? <Download size={18} /> : 
                                     job.type === 'clean_backups' ? <Trash2 size={18} /> : 
                                     job.type === 'clean_logs' ? <Trash2 size={18} /> : 
                                     <TriangleAlert size={18} />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-medium text-foreground tracking-tight">
                                        {job.type === 'restart' ? 'Redémarrage planifié' : 
                                         job.type === 'start' ? 'Démarrage planifié' : 
                                         job.type === 'stop' ? 'Arrêt planifié' : 
                                         job.type === 'backup' ? 'Sauvegarde automatique' : 
                                         job.type === 'clean_backups' ? 'Nettoyage des sauvegardes' : 
                                         job.type === 'clean_logs' ? 'Nettoyage des logs' : 
                                         'Tâche personnalisée'}
                                    </span>
                                    <span className="text-xs text-muted-foreground mt-0.5">
                                        {parseCronTimeToText(job.cronExp)}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="mt-4 sm:mt-0 pl-14 sm:pl-0">
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleDeleteJob(job.id)}
                                    className="text-danger hover:text-danger hover:bg-danger/10"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
};
