import React from 'react';
import { Search } from 'lucide-react';

interface PlayerToolbarProps {
    search: string;
    setSearch: (s: string) => void;
    filter: 'all' | 'online' | 'ops' | 'banned' | 'whitelisted';
    setFilter: (f: 'all' | 'online' | 'ops' | 'banned' | 'whitelisted') => void;
}

export const PlayerToolbar: React.FC<PlayerToolbarProps> = ({ search, setSearch, filter, setFilter }) => {
    return (
        <div className="p-4 border-b border-zinc-800 flex flex-col md:flex-row md:items-center gap-4 justify-between bg-zinc-900/50">
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input 
                    type="text" 
                    placeholder="Rechercher un joueur..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm rounded-lg pl-9 pr-4 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
            </div>
            <div className="flex gap-2">
                {(['all', 'online', 'ops', 'banned', 'whitelisted'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                            filter === f 
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                                : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                    >
                        {f}
                    </button>
                ))}
            </div>
        </div>
    );
};
