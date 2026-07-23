import { SearchInput } from '../ui/SearchInput';
import { Tabs, TabsList, TabsTrigger } from '../ui/Tabs';

interface PlayerToolbarProps {
    search: string;
    setSearch: (s: string) => void;
    filter: 'all' | 'online' | 'ops' | 'banned' | 'whitelisted';
    setFilter: (f: 'all' | 'online' | 'ops' | 'banned' | 'whitelisted') => void;
}

export const PlayerToolbar: React.FC<PlayerToolbarProps> = ({ search, setSearch, filter, setFilter }) => {
    return (
        <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center gap-4 justify-between bg-surface/50">
            <SearchInput 
                value={search}
                onChange={setSearch}
                placeholder="Rechercher un joueur..."
                className="w-full md:w-64"
            />
            <div className="flex gap-2">
                <Tabs value={filter} onValueChange={(val) => setFilter(val as any)}>
                    <TabsList>
                        {(['all', 'online', 'ops', 'banned', 'whitelisted'] as const).map(f => (
                            <TabsTrigger
                                key={f}
                                value={f}
                                className="capitalize"
                            >
                                {f}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </div>
        </div>
    );
};
