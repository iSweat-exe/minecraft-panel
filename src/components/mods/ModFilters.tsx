import React from 'react';
import { Filter, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';

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

                <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                    <SelectTrigger className="w-[140px] bg-surface h-[38px] border-border text-foreground">
                        <SelectValue placeholder="Toutes versions" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Toutes versions</SelectItem>
                        <SelectItem value="26.2">26.2</SelectItem>
                        <SelectItem value="26.1.2">26.1.2</SelectItem>
                        <SelectItem value="26.1.1">26.1.1</SelectItem>
                        <SelectItem value="26.1">26.1</SelectItem>
                        <SelectItem value="1.21.11">1.21.11</SelectItem>
                        <SelectItem value="1.21.10">1.21.10</SelectItem>
                        <SelectItem value="1.21.9">1.21.9</SelectItem>
                        <SelectItem value="1.21.8">1.21.8</SelectItem>
                        <SelectItem value="1.21.7">1.21.7</SelectItem>
                        <SelectItem value="1.21.6">1.21.6</SelectItem>
                        <SelectItem value="1.21.5">1.21.5</SelectItem>
                        <SelectItem value="1.21.4">1.21.4</SelectItem>
                        <SelectItem value="1.21.3">1.21.3</SelectItem>
                        <SelectItem value="1.21.2">1.21.2</SelectItem>
                        <SelectItem value="1.21.1">1.21.1</SelectItem>
                        <SelectItem value="1.21">1.21</SelectItem>
                        <SelectItem value="1.20.6">1.20.6</SelectItem>
                        <SelectItem value="1.20.5">1.20.5</SelectItem>
                        <SelectItem value="1.20.4">1.20.4</SelectItem>
                        <SelectItem value="1.20.3">1.20.3</SelectItem>
                        <SelectItem value="1.20.2">1.20.2</SelectItem>
                        <SelectItem value="1.20.1">1.20.1</SelectItem>
                        <SelectItem value="1.20">1.20</SelectItem>
                        <SelectItem value="1.19.4">1.19.4</SelectItem>
                        <SelectItem value="1.19.3">1.19.3</SelectItem>
                        <SelectItem value="1.19.2">1.19.2</SelectItem>
                        <SelectItem value="1.19.1">1.19.1</SelectItem>
                        <SelectItem value="1.19">1.19</SelectItem>
                        <SelectItem value="1.18.2">1.18.2</SelectItem>
                        <SelectItem value="1.18.1">1.18.1</SelectItem>
                        <SelectItem value="1.18">1.18</SelectItem>
                        <SelectItem value="1.17.1">1.17.1</SelectItem>
                        <SelectItem value="1.17">1.17</SelectItem>
                        <SelectItem value="1.16.5">1.16.5</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={selectedLoader} onValueChange={setSelectedLoader}>
                    <SelectTrigger className="w-[140px] bg-surface h-[38px] border-border text-foreground">
                        <SelectValue placeholder="Tous Loaders" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous Loaders</SelectItem>
                        <SelectItem value="fabric">Fabric</SelectItem>
                        <SelectItem value="forge">Forge</SelectItem>
                        <SelectItem value="neoforge">NeoForge</SelectItem>
                        <SelectItem value="quilt">Quilt</SelectItem>
                    </SelectContent>
                </Select>
                
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
