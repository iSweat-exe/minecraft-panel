let credentials: { host: string; port: string; token: string; username?: string } | null = null;

export function setCredentials(host: string, port: string, token: string, username?: string) {
    let cleanHost = host.replace(/^https?:\/\//i, '');
    if (cleanHost.endsWith('/')) {
        cleanHost = cleanHost.slice(0, -1);
    }
    credentials = { host: cleanHost, port, token, username };
}

export function getCredentials() {
    if (!credentials) throw new Error("Not connected");
    return { ...credentials };
}

export function getNodeUrl() {
    const { host, port } = getCredentials();
    return `${Number(port) === 443 || Number(port) === 8443 ? 'https' : 'http'}://${host}:${port}`;
}

export function getToken() {
    const { token, username } = getCredentials();
    return username ? `${token}::${username}` : token;
}

export function clearCredentials() {
    credentials = null;
}

export function isConnected() {
    return credentials !== null;
}
