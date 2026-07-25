let credentials: { host: string; port: string; token: string; username?: string } | null = null;

export function setCredentials(host: string, port: string, token: string, username?: string) {
    credentials = { host, port, token, username };
}

export function getCredentials() {
    if (!credentials) throw new Error("Not connected");
    return { ...credentials };
}

export function getNodeUrl() {
    const { host, port } = getCredentials();
    return `http://${host}:${port}`;
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
