/** Copia temporaria do perfil OAuth. Nao e token SUAP nem sessao Moodle. */
export const OAUTH_PROFILE_KEY = 'ifrn_suap_oauth_profile_v1';
/** Prazo do cache local; não estende tokens nem cookies dos servidores. */
export const OAUTH_PROFILE_MAX_AGE_SECONDS = 30 * 24 * 3600;

export interface OAuthProfileSnapshot {
    profile: Record<string, unknown>;
    identity: string;
    expiresAt: number;
}

export function profileIdentity(profile: Record<string, unknown>): string {
    const value = profile['identificacao'];

    return typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value))
        ? String(value).trim() : '';
}

export function hasOAuthProfileMode(): boolean {
    return sessionStorage.getItem(OAUTH_PROFILE_KEY) !== null
        || localStorage.getItem(OAUTH_PROFILE_KEY) !== null;
}

export function readOAuthProfile(): OAuthProfileSnapshot | null {
    try {
        let raw = sessionStorage.getItem(OAUTH_PROFILE_KEY);
        if (!raw) {
            raw = localStorage.getItem(OAUTH_PROFILE_KEY);
        }

        const value = JSON.parse(raw || 'null') as OAuthProfileSnapshot | null;
        const currentUsername = sessionStorage.getItem('ifrn_username') || localStorage.getItem('ifrn_username');

        if (!value || !value.profile || typeof value.profile !== 'object' || Array.isArray(value.profile)
                || !value.identity || profileIdentity(value.profile) !== value.identity
                || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()
                || (currentUsername && currentUsername !== value.identity)) {
            return null;
        }

        if (!sessionStorage.getItem('ifrn_username')) {
            sessionStorage.setItem('ifrn_username', value.identity);
        }
        if (raw && sessionStorage.getItem(OAUTH_PROFILE_KEY) !== raw) {
            sessionStorage.setItem(OAUTH_PROFILE_KEY, raw);
        }

        return value;
    } catch {
        return null;
    }
}

export function saveOAuthProfile(profile: Record<string, unknown>, expiresIn: number): void {
    const identity = profileIdentity(profile);
    if (!identity || identity.length > 150 || !Number.isFinite(expiresIn) || expiresIn <= 0) {
        throw new Error('O SUAP não retornou uma identificação válida. Use o login atual.');
    }
    // Nunca alongar um prazo menor informado pelo chamador. Ler/reabrir não renova.
    const durationSeconds = Math.min(expiresIn, OAUTH_PROFILE_MAX_AGE_SECONDS);
    const data = JSON.stringify({
        profile,
        identity,
        expiresAt: Date.now() + durationSeconds * 1000,
    });
    sessionStorage.setItem(OAUTH_PROFILE_KEY, data);
    localStorage.setItem(OAUTH_PROFILE_KEY, data);
}

export function clearOAuthProfile(): void {
    sessionStorage.removeItem(OAUTH_PROFILE_KEY);
    localStorage.removeItem(OAUTH_PROFILE_KEY);
}

/** Restaura todas as listas do painel apenas quando pertencem ao perfil válido. */
export function readOAuthDashboard(): Record<string, unknown> | unknown[] | null {
    const snapshot = readOAuthProfile();
    if (!snapshot) {
        return null;
    }
    try {
        // Owner e dados vêm sempre do mesmo armazenamento, sem misturar contas.
        const storage = sessionStorage.getItem('ifrn_painel_dashboard') !== null
            ? sessionStorage : localStorage;
        const raw = storage.getItem('ifrn_painel_dashboard');
        const owner = storage.getItem('ifrn_painel_owner');
        if (!raw || !owner || owner.trim().toLowerCase() !== snapshot.identity.trim().toLowerCase()) {
            return null;
        }
        const dashboard: unknown = JSON.parse(raw);
        if (!dashboard || typeof dashboard !== 'object') {
            return null;
        }
        const restored = {
            ifrn_painel_dashboard: raw,
            ifrn_painel_owner: owner,
            ifrn_painel_profile: JSON.stringify(snapshot.profile),
        };
        for (const [key, value] of Object.entries(restored)) {
            if (sessionStorage.getItem(key) !== value) sessionStorage.setItem(key, value);
        }

        return dashboard as Record<string, unknown> | unknown[];
    } catch {
        return null;
    }
}

