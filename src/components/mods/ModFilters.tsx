import React from 'react';
import { Filter, Search } from 'lucide-react';

interface ModFiltersProps {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    selectedVersion: string;
    setSelectedVersion: (v: string) => void;
    selectedLoader: string;
    setSelectedLoader: (l: string) => void;
    onSearch: () => void;
}

export const ModFilters: React.FC<ModFiltersProps> = ({
    searchQuery,
    setSearchQuery,
    selectedVersion,
    setSelectedVersion,
    selectedLoader,
    setSelectedLoader,
    onSearch
}) => {
    return (
        <div className="flex flex-col md:flex-row gap-4 items-center bg-background border border-border rounded-lg p-3">
            <div className="relative flex-1 w-full">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                    type="text" 
                    placeholder="Rechercher des mods (ex: Sodium, Lithium...)"
                    className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-md text-sm focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 px-2 border-r border-border">
                    <Filter size={16} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground font-medium hidden sm:inline">Filtres</span>
                </div>

                <select 
                    value={selectedVersion} 
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary min-w-[120px]"
                >
                    <option value="all">Toutes versions</option>
                    <option value="1.21.1">1.21.1</option>
                    <option value="1.21">1.21</option>
                    <option value="1.20.4">1.20.4</option>
                    <option value="1.20.1">1.20.1</option>
                    <option value="1.19.4">1.19.4</option>
                    <option value="1.19.2">1.19.2</option>
                    <option value="1.18.2">1.18.2</option>
                    <option value="1.16.5">1.16.5</option>
                </select>

                <select 
                    value={selectedLoader} 
                    onChange={(e) => setSelectedLoader(e.target.value)}
                    className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary min-w-[120px]"
                >
                    <option value="all">Tous Loaders</option>
                    <option value="fabric">Fabric</option>
                    <option value="forge">Forge</option>
                    <option value="neoforge">NeoForge</option>
                    <option value="quilt">Quilt</option>
                </select>
                
                <button
                    onClick={onSearch}
                    className="px-4 py-2 bg-surface hover:bg-surface-hover text-foreground border border-border rounded-md text-sm font-medium transition-colors"
                >
                    Rechercher
                </button>
            </div>
        </div>
    );
};
