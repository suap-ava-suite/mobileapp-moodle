/** Marca apenas a transição mobile. Não contém credenciais nem autoriza acesso. */
const KEY = 'ifrn_native_suap_entry';
export function beginNativeSuapEntry(expectedIdentity: string): void {
    sessionStorage.setItem(KEY, JSON.stringify({ expectedIdentity, until: Date.now() + 300000 }));
}
export function readNativeSuapEntry(): { expectedIdentity: string; until: number; authenticatedSiteId?: string } | null {
    try {
        const value = JSON.parse(sessionStorage.getItem(KEY) || 'null');
        return value && typeof value.expectedIdentity === 'string'
            && Number.isFinite(value.until) && value.until > Date.now() ? value : null;
    } catch {
        return null;
    }
}
export function endNativeSuapEntry(): void {
    sessionStorage.removeItem(KEY);
}

/** Chamado somente pelo evento LOGIN do núcleo, após aceitar o retorno SSO. */
export function markNativeSuapEntryAuthenticated(siteId: string): void {
    const entry = readNativeSuapEntry();
    if (entry && siteId) {
        sessionStorage.setItem(KEY, JSON.stringify({ ...entry, authenticatedSiteId: siteId }));
    }
}
