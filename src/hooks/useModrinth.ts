import { useState, useCallback, useRef } from 'react';

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

export const useModrinth = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const searchMods = useCallback(async (
        query: string, 
        version?: string, 
        loader?: string,
        offset: number = 0
    ): Promise<SearchResult | null> => {
        setLoading(true);
        setError(null);
        try {
            const url = new URL('https://api.modrinth.com/v2/search');
            url.searchParams.set('query', query);
            url.searchParams.set('limit', '20');
            url.searchParams.set('offset', offset.toString());

            const facets: string[][] = [];
            if (version && version !== 'all') {
                facets.push([`versions:${version}`]);
            }
            if (loader && loader !== 'all') {
                facets.push([`categories:${loader}`]);
            }
            
            // Server-side mostly
            facets.push(['project_type:mod']);

            if (facets.length > 0) {
                url.searchParams.set('facets', JSON.stringify(facets));
            }

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
            
            const data: SearchResult = await response.json();
            return data;
        } catch (e: any) {
            setError(e.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const getLatestVersion = useCallback(async (
        projectId: string,
        version?: string,
        loader?: string
    ): Promise<ModrinthVersion | null> => {
        setLoading(true);
        setError(null);
        try {
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
            if (versions.length === 0) return null;
            
            return versions[0];
        } catch (e: any) {
            setError(e.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        searchMods,
        getLatestVersion,
        loading,
        error
    };
};
