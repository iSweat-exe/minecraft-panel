import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface PlayerToolbarProps {
    search: string;
    setSearch: (s: string) => void;
    filter: 'all' | 'online' | 'ops' | 'banned' | 'whitelisted';
    setFilter: (f: 'all' | 'online' | 'ops' | 'banned' | 'whitelisted') => void;
}

export const PlayerToolbar: React.FC<PlayerToolbarProps> = ({ search, setSearch, filter, setFilter }) => {
    return (
        <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center gap-4 justify-between bg-surface/50">
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" size={16} />
                <Input 
                    type="text" 
                    placeholder="Rechercher un joueur..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>
            <div className="flex gap-2">
                {(['all', 'online', 'ops', 'banned', 'whitelisted'] as const).map(f => (
                    <Button
                        key={f}
                        onClick={() => setFilter(f)}
                        variant={filter === f ? 'primary' : 'outline'}
                        size="sm"
                        className="capitalize"
                    >
                        {f}
                    </Button>
                ))}
            </div>
        </div>
    );
};
