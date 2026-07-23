import React from 'react';
import { Download, Server, Monitor, Check, Loader2, Info } from 'lucide-react';
import { ModrinthProject } from '../../api/modrinth';

interface ModCardProps {
    mod: ModrinthProject;
    onInstall: (mod: ModrinthProject) => void;
    onViewDetails?: (mod: ModrinthProject) => void;
    isInstalling: boolean;
    isInstalled?: boolean;
}

export const ModCard: React.FC<ModCardProps> = ({ 
    mod, 
    onInstall, 
    onViewDetails, 
    isInstalling, 
    isInstalled 
}) => {
    // Format large numbers (e.g. 1500000 -> 1.5M)
    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    return (
        <div className="bg-background border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/50 transition-colors group">
            <div 
                className="flex gap-4 cursor-pointer" 
                onClick={() => onViewDetails?.(mod)}
                title="Cliquer pour voir la fiche complète"
            >
                <img 
                    src={mod.icon_url || 'https://docs.modrinth.com/img/logo.svg'} 
                    alt={mod.title} 
                    className="w-16 h-16 rounded-md object-cover bg-surface shrink-0 group-hover:scale-105 transition-transform"
                />
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-lg truncate group-hover:text-primary transition-colors" title={mod.title}>
                        {mod.title}
                    </h3>
                    <div className="text-sm text-muted-foreground truncate">par {mod.author}</div>
                    
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground bg-surface px-2 py-0.5 rounded font-mono">
                            <Download size={12} /> {formatNumber(mod.downloads)}
                        </span>
                        
                        {/* Loaders badges */}
                        {mod.display_categories.filter(c => ['fabric', 'forge', 'quilt', 'neoforge'].includes(c)).map(loader => (
                            <span key={loader} className="text-xs px-2 py-0.5 rounded capitalize bg-primary/10 text-primary font-medium">
                                {loader}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <p 
                className="text-sm text-muted-foreground line-clamp-2 mt-2 h-10 cursor-pointer"
                onClick={() => onViewDetails?.(mod)}
            >
                {mod.description}
            </p>

            <div className="flex items-center justify-between mt-auto pt-3 border-t border-border gap-2">
                <div className="flex gap-2 items-center">
                    {/* Sides */}
                    {mod.server_side !== 'unsupported' && (
                        <div className="flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-1 rounded" title={`Server: ${mod.server_side}`}>
                            <Server size={14} /> Server
                        </div>
                    )}
                    {mod.client_side !== 'unsupported' && (
                        <div className="flex items-center gap-1 text-xs text-warning bg-warning/10 px-2 py-1 rounded" title={`Client: ${mod.client_side}`}>
                            <Monitor size={14} /> Client
                        </div>
                    )}

                    {onViewDetails && (
                        <button
                            onClick={() => onViewDetails(mod)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-surface transition-colors"
                            title="Voir la description et la galerie"
                        >
                            <Info size={14} /> Fiche
                        </button>
                    )}
                </div>

                {isInstalled ? (
                    <button
                        disabled
                        className="flex items-center gap-2 px-4 py-1.5 bg-surface border border-border text-success text-sm font-medium rounded opacity-80 cursor-default"
                    >
                        <Check size={16} /> Installé
                    </button>
                ) : (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onInstall(mod);
                        }}
                        disabled={isInstalling}
                        className="flex items-center gap-2 px-4 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-medium rounded transition-colors"
                    >
                        {isInstalling ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        {isInstalling ? 'Installation...' : 'Installer'}
                    </button>
                )}
            </div>
        </div>
    );
};
