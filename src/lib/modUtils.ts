import { ModrinthProject } from '../api/modrinth';
import { useModsStore } from '../store/modsStore';

// Cache for mod metadata to avoid redundant Modrinth API calls
const metadataCache = new Map<string, ModrinthProject | null>();

// Cache for update availability
export const hasUpdateCache = new Map<string, boolean>();

/**
 * Parses a mod filename and extracts meaningful words to use for searching.
 * e.g., 'authme-fabric-9.3.0+26.2.jar' -> 'authme'
 * e.g., 'balm-fabric-26.2.jar' -> 'balm'
 * e.g., 'Mon-Super-Mod-1.0.jar.disable' -> 'Mon Super Mod'
 */
export function parseModFilename(filename: string): string {
    // Remove extensions
    let name = filename.replace(/\.disable$/, '').replace(/\.disabled$/, '').replace(/\.jar$/, '');
    
    // Remove common loader and version strings using regex
    // This is a heuristic and might need adjustment
    const ignoreWords = ['fabric', 'forge', 'quilt', 'neoforge', 'mc', 'v'];
    
    // Replace non-alphanumeric chars with spaces, except dots which might be part of versions
    // Actually, splitting by -, _, +, space is better
    const parts = name.split(/[-_+ ]+/);
    
    const words: string[] = [];
    
    const isVersion = (str: string) => {
        return /\d+\.\d+/.test(str) || /^mc\d+/.test(str) || /^v\d+/.test(str);
    };
    
    // Some modders use abbreviations in filenames but full names on Modrinth
    const aliases: Record<string, string> = {
        'mcw': 'macaw',
    };
    
    for (const part of parts) {
        let lower = part.toLowerCase();
        
        // Stop parsing completely if we hit something that looks like a version number
        // Because everything after the version is usually more version info (e.g. rc-2, build, etc.)
        if (isVersion(lower)) {
            break;
        }
        
        // Skip common loaders (don't stop, just skip)
        if (ignoreWords.includes(lower)) {
            continue;
        }
        
        // Apply aliases
        if (aliases[lower]) {
            lower = aliases[lower];
        }
        
        // Keep the word
        if (part.length > 0) {
            words.push(lower);
        }
    }
    
    // Fallback: if we ignored everything and have no words (e.g. "Fabric-API-1.20" -> "API" (fabric was ignored))
    // Wait, if it was "fabric-api", fabric is skipped, api is kept.
    return words.join(' ');
}

/**
 * Tries to extract a version string from a mod filename.
 */
export function extractModVersion(filename: string): string | null {
    // Regex to find things like 1.20.1, 1.3, v1.0, 9.3.0+26.2
    const match = filename.match(/(?:v)?(\d+\.\d+(?:\.\d+)?(?:[+-][\w.]+)?)/i);
    if (match) {
        return match[1];
    }
    return null;
}

/**
 * Fetches mod metadata from Modrinth API using the parsed filename.
 * Implements a simple memory cache to avoid spamming the API.
 */
export async function getModMetadata(filename: string): Promise<ModrinthProject | null> {
    const query = parseModFilename(filename);
    
    if (!query) return null;
    
    // First, check if it was perfectly resolved by hash and cached under the filename
    if (metadataCache.has(filename)) {
        return metadataCache.get(filename) || null;
    }
    
    try {
        const { lastSelectedVersion, lastSelectedLoader } = useModsStore.getState();
        
        // Cache key should include filters so we don't return the wrong mod if filters change
        const cacheKey = `${query}_${lastSelectedVersion}_${lastSelectedLoader}`;
        if (metadataCache.has(cacheKey)) {
            return metadataCache.get(cacheKey) || null;
        }

        const url = new URL('https://api.modrinth.com/v2/search');
        url.searchParams.set('query', query);
        url.searchParams.set('limit', '1'); // We only need the top match
        
        const facets: string[][] = [['project_type:mod']];
        if (lastSelectedLoader && lastSelectedLoader !== 'all') {
            facets.push([`categories:${lastSelectedLoader.toLowerCase()}`]);
        }
        if (lastSelectedVersion && lastSelectedVersion !== 'all') {
            facets.push([`versions:${lastSelectedVersion}`]);
        }
        
        url.searchParams.set('facets', JSON.stringify(facets));
        
        console.log(`[Modrinth Fetch] Fetching metadata for filename: "${filename}"`);
        console.log(`[Modrinth Fetch] Query: "${query}", Facets:`, facets);
        
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        
        const data = await response.json();
        
        if (data.hits && data.hits.length > 0) {
            const project = data.hits[0];
            console.log(`[Modrinth Fetch] Success for "${filename}" -> Found Project: "${project.title}"`, {
                loaders: project.categories?.filter((c: string) => ['fabric', 'forge', 'quilt', 'neoforge'].includes(c)),
                versions: project.versions,
                raw: project
            });
            metadataCache.set(cacheKey, project);
            return project;
        }
        
        console.log(`[Modrinth Fetch] No results found for "${filename}"`);
        metadataCache.set(cacheKey, null);
        return null;
    } catch (e) {
        console.error("Failed to fetch mod metadata for", query, e);
        return null;
    }
}

/**
 * Preloads Modrinth metadata for a batch of files using their SHA-1 hashes.
 * @param fileHashMap Map of { filename: sha1_hash }
 */
export async function preloadModsByHashes(fileHashMap: Record<string, string>) {
    const hashes = Object.values(fileHashMap);
    if (hashes.length === 0) return;

    try {
        console.log(`[Modrinth Hash] Batch resolving ${hashes.length} files by hash...`);
        
        // 1. Resolve hashes to version files
        const versionRes = await fetch('https://api.modrinth.com/v2/version_files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hashes, algorithm: 'sha1' })
        });
        
        if (!versionRes.ok) throw new Error(`Hash resolve error: ${versionRes.status}`);
        const versionData: Record<string, any> = await versionRes.json();

        // 1.5. Check for updates
        try {
            const { lastSelectedVersion, lastSelectedLoader } = useModsStore.getState();
            if (lastSelectedVersion && lastSelectedLoader) {
                const updateRes = await fetch('https://api.modrinth.com/v2/version_files/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        hashes,
                        algorithm: 'sha1',
                        loaders: lastSelectedLoader !== 'all' ? [lastSelectedLoader.toLowerCase()] : [],
                        game_versions: lastSelectedVersion !== 'all' ? [lastSelectedVersion] : []
                    })
                });
                
                if (updateRes.ok) {
                    const updateData = await updateRes.json();
                    
                    for (const [hash, updateVersion] of Object.entries(updateData)) {
                        const currentVersion = versionData[hash];
                        if (currentVersion && (updateVersion as any).id !== currentVersion.id) {
                            const filename = Object.keys(fileHashMap).find(name => fileHashMap[name] === hash);
                            if (filename) {
                                hasUpdateCache.set(filename, true);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error("[Modrinth Hash] Failed to check for updates:", e);
        }
        
        // Map hash -> project_id
        const projectIdToHash = new Map<string, string>();
        const projectIds = new Set<string>();
        
        for (const [hash, version] of Object.entries(versionData)) {
            if (version && version.project_id) {
                projectIdToHash.set(version.project_id, hash);
                projectIds.add(version.project_id);
            }
        }
        
        if (projectIds.size === 0) {
            console.log("[Modrinth Hash] No hashes recognized by Modrinth.");
            return;
        }

        const idsArray = Array.from(projectIds);
        const projectsRes = await fetch(`https://api.modrinth.com/v2/projects?ids=${JSON.stringify(idsArray)}`);
        if (!projectsRes.ok) throw new Error(`Projects fetch error: ${projectsRes.status}`);
        
        const projectsData: any[] = await projectsRes.json();
        
        // Fetch teams to get authors & avatars
        const teamIds = new Set<string>();
        projectsData.forEach(p => {
            if (p.team) teamIds.add(p.team);
        });
        
        let teamsData: any[][] = [];
        if (teamIds.size > 0) {
            try {
                const tRes = await fetch(`https://api.modrinth.com/v2/teams?ids=${JSON.stringify(Array.from(teamIds))}`);
                if (tRes.ok) teamsData = await tRes.json();
            } catch (e) {
                console.error("[Modrinth Hash] Failed to fetch teams:", e);
            }
        }
        
        const teamMap = new Map<string, any>();
        teamsData.forEach(teamMembers => {
            if (teamMembers && teamMembers.length > 0) {
                const lead = teamMembers.find((m: any) => m.role === 'Project Lead' || m.role === 'Owner') || teamMembers[0];
                if (lead && lead.user) {
                    teamMap.set(lead.team_id, lead.user);
                }
            }
        });
        
        // 3. Map back to filename and cache
        let resolvedCount = 0;
        for (const project of projectsData) {
            const hash = projectIdToHash.get(project.id);
            if (!hash) continue;
            
            // Add author info
            if (project.team && teamMap.has(project.team)) {
                const user = teamMap.get(project.team);
                project.author = user.username || project.author;
                project.author_avatar = user.avatar_url;
            }
            
            // Find filename for this hash
            const filename = Object.keys(fileHashMap).find(name => fileHashMap[name] === hash);
            if (filename) {
                console.log(`[Modrinth Hash] Perfectly resolved: "${filename}" -> "${project.title}" by ${project.author}`);
                metadataCache.set(filename, project);
                resolvedCount++;
            }
        }
        console.log(`[Modrinth Hash] Successfully preloaded ${resolvedCount} mods by hash.`);

    } catch (e) {
        console.error("[Modrinth Hash] Failed to batch preload by hashes:", e);
    }
}
