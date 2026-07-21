import { useQuery } from '@tanstack/react-query';

export interface ModrinthProject {
    project_id: string;
    slug: string;
    title: string;
    description: string;
    categories: string[];
    display_categories: string[];
    versions: string[];
    downloads: number;
    icon_url: string;
    author: string;
    author_avatar?: string;
    team?: string;
    client_side: 'required' | 'optional' | 'unsupported';
    server_side: 'required' | 'optional' | 'unsupported';
    date_modified: string;
}

export interface SearchResult {
    hits: ModrinthProject[];
    offset: number;
    limit: number;
    total_hits: number;
}

export interface ModrinthVersion {
    id: string;
    project_id: string;
    author_id: string;
    featured: boolean;
    name: string;
    version_number: string;
    changelog?: string;
    date_published: string;
    version_type: 'release' | 'beta' | 'alpha';
    game_versions: string[];
    loaders: string[];
    files: {
        hashes: {
            sha512: string;
            sha1: string;
        };
        url: string;
        filename: string;
        primary: boolean;
        size: number;
    }[];
}

export const fetchMods = async (
    query: string,
    version?: string,
    loader?: string,
    offset: number = 0,
    limit: number = 15
): Promise<SearchResult> => {
    const url = new URL('https://api.modrinth.com/v2/search');
    url.searchParams.set('query', query);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('offset', offset.toString());

    const facets: string[][] = [];
    if (version && version !== 'all') {
        facets.push([`versions:${version}`]);
    }
    if (loader && loader !== 'all') {
        facets.push([`categories:${loader}`]);
    }
    
    facets.push(['project_type:mod']);

    if (facets.length > 0) {
        url.searchParams.set('facets', JSON.stringify(facets));
    }

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    
    return response.json();
};

export const fetchLatestVersion = async (
    projectId: string,
    version?: string,
    loader?: string
): Promise<ModrinthVersion | null> => {
    const url = new URL(`https://api.modrinth.com/v2/project/${projectId}/version`);
    
    if (version && version !== 'all') {
        url.searchParams.set('game_versions', JSON.stringify([version]));
    }
    if (loader && loader !== 'all') {
        url.searchParams.set('loaders', JSON.stringify([loader]));
    }

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    
    const versions: ModrinthVersion[] = await response.json();
    return versions.length > 0 ? versions[0] : null;
};

export const fetchProjectVersions = async (
    projectId: string
): Promise<ModrinthVersion[]> => {
    const url = new URL(`https://api.modrinth.com/v2/project/${projectId}/version`);
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    return response.json();
};

export const useSearchModsQuery = (
    query: string,
    version: string,
    loader: string,
    offset: number,
    limit: number
) => {
    return useQuery({
        queryKey: ['mods', query, version, loader, offset, limit],
        queryFn: () => fetchMods(query, version, loader, offset, limit),
        staleTime: 60000,
        placeholderData: (prev) => prev // keeps old data while fetching new page
    });
};
