import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Clock, Plus, Trash2, Power, Download, Save, TriangleAlert, Info } from 'lucide-react';
import { tauriBridge } from '../lib/tauriBridge';
import { useConnectionStore } from '../store/connectionStore';
import { useToastStore } from '../store/toastStore';
import { ConfirmDialog } from './dialogs/ConfirmDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select';
import { logAction } from '../lib/actionLogger';

type JobType = 'restart' | 'start' | 'stop' | 'backup' | 'clean_backups' | 'clean_logs' | 'custom';

interface CronJob {
    id: string;
    type: JobType;
    cronExp: string;
    command: string;
    rawLine: string;
}

const CRON_TAG = '# MINECRAFT-PANEL-JOB';

export const AutomationsPanel: React.FC = () => {
    const { sshStatus } = useConnectionStore();
    const [jobs, setJobs] = useState<CronJob[]>([]);
    const [loading, setLoading] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [newJobType, setNewJobType] = useState<JobType>('restart');
    const [newJobTime, setNewJobTime] = useState('04:00'); // HH:MM

    useEffect(() => {
        if (sshStatus === 'connected') {
            loadCrontab();
        }
    }, [sshStatus]);

    const loadCrontab = async () => {
        setLoading(true);
        try {
            const out = await tauriBridge.sshExecute(`crontab -l || echo ""`);
            const lines = out.split('\n');
            const parsedJobs: CronJob[] = [];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith(CRON_TAG)) {
                    // The next line is the actual cron job
                    const nextLine = lines[i + 1]?.trim();
                    if (nextLine && !nextLine.startsWith('#')) {
                        const parts = nextLine.split(' ');
                        const cronExp = parts.slice(0, 5).join(' ');
                        const command = parts.slice(5).join(' ');
                        
                        let type: JobType = 'custom';
                        if (command.includes('systemctl --user restart minecraft')) type = 'restart';
                        else if (command.includes('systemctl --user start minecraft')) type = 'start';
                        else if (command.includes('systemctl --user stop minecraft')) type = 'stop';
                        else if (command.includes('tar -czf')) type = 'backup';
                        else if (command.includes('find ~/minecraft_backups')) type = 'clean_backups';
                        else if (command.includes('find ~/minecraft/logs')) type = 'clean_logs';

                        parsedJobs.push({
                            id: Math.random().toString(36).substr(2, 9),
                            type,
                            cronExp,
                            command,
                            rawLine: nextLine
                        });
                        i++; // Skip next line
                    }
                }
            }
            setJobs(parsedJobs);
        } catch (err: any) {
            if (err !== 'Not connected') {
                console.error("Failed to load crontab:", err);
            }
        } finally {
            setLoading(false);
        }
    };

    const saveCrontab = async (newJobs: CronJob[]) => {
        try {
            const out = await tauriBridge.sshExecute(`crontab -l || echo ""`);
            // Strip old panel jobs
            const lines = out.split('\n');
            const newLines: string[] = [];
            let skipNext = false;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (skipNext) {
                    skipNext = false;
                    continue;
                }
                if (line.startsWith(CRON_TAG)) {
                    skipNext = true; // skip the command line
                    continue;
                }
                if (line.length > 0) {
                    newLines.push(line);
                }
            }

            // Append new jobs
            for (const job of newJobs) {
                newLines.push(CRON_TAG + '-' + job.type.toUpperCase());
                newLines.push(job.rawLine);
            }

            const newCrontab = newLines.join('\n') + '\n';
            const escaped = newCrontab.replace(/"/g, '\\"');
            await tauriBridge.sshExecute(`echo "${escaped}" | crontab -`);
            setJobs(newJobs);
            useToastStore.getState().addToast({ type: 'success', message: 'Crontab mis à jour' });
        } catch (err) {
            console.error(err);
            useToastStore.getState().addToast({ type: 'error', message: 'Erreur lors de la mise à jour du crontab' });
        }
    };

    const handleAddJob = async () => {
        const [hours, minutes] = newJobTime.split(':');
        const cronExp = `${minutes} ${hours} * * *`;
        let command = '';
        
        if (newJobType === 'restart') {
            command = 'XDG_RUNTIME_DIR=/run/user/$(id -u) systemctl --user restart minecraft > /dev/null 2>&1';
        } else if (newJobType === 'start') {
            command = 'XDG_RUNTIME_DIR=/run/user/$(id -u) systemctl --user start minecraft > /dev/null 2>&1';
        } else if (newJobType === 'stop') {
            command = 'XDG_RUNTIME_DIR=/run/user/$(id -u) systemctl --user stop minecraft > /dev/null 2>&1';
        } else if (newJobType === 'backup') {
            command = 'mkdir -p ~/minecraft_backups && tar -czf ~/minecraft_backups/backup_$(date +\\%Y\\%m\\%d_\\%H\\%M\\%S).tar.gz -C ~/minecraft . > /dev/null 2>&1';
        } else if (newJobType === 'clean_backups') {
            command = 'find ~/minecraft_backups -name "*.tar.gz" -mtime +7 -delete > /dev/null 2>&1';
        } else if (newJobType === 'clean_logs') {
            command = 'find ~/minecraft/logs -name "*.log.gz" -mtime +7 -delete > /dev/null 2>&1';
        }

        const newJob: CronJob = {
            id: Math.random().toString(36).substr(2, 9),
            type: newJobType,
            cronExp,
            command,
            rawLine: `${cronExp} ${command}`
        };

        await saveCrontab([...jobs, newJob]);
        
        logAction('Ajout d\'une tâche planifiée', { type: newJobType, time: newJobTime });
        
        setIsEditing(false);
    };

    const handleDeleteJob = async (id: string) => {
        const ok = await ConfirmDialog.call({ message: 'Êtes-vous sûr de vouloir supprimer cette tâche planifiée ?' });
        if (ok) {
            const job = jobs.find(j => j.id === id);
            await saveCrontab(jobs.filter(j => j.id !== id));
            if (job) {
                logAction('Suppression d\'une tâche planifiée', { type: job.type });
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
                                onValueChange={(val) => setNewJobType(val as 'restart' | 'backup')}
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
