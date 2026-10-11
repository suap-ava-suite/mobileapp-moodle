/** Copia temporaria do perfil OAuth. Nao e token SUAP nem sessao Moodle. */
export const OAUTH_PROFILE_KEY = 'ifrn_suap_oauth_profile_v1';

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
    return sessionStorage.getItem(OAUTH_PROFILE_KEY) !== null;
}

export function readOAuthProfile(): OAuthProfileSnapshot | null {
    try {
        const value = JSON.parse(sessionStorage.getItem(OAUTH_PROFILE_KEY) || 'null') as OAuthProfileSnapshot | null;
        if (!value || !value.profile || typeof value.profile !== 'object' || Array.isArray(value.profile)
                || !value.identity || profileIdentity(value.profile) !== value.identity
                || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()
                || sessionStorage.getItem('ifrn_username') !== value.identity) {
            return null;
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
    sessionStorage.setItem(OAUTH_PROFILE_KEY, JSON.stringify({
        profile, identity, expiresAt: Date.now() + Math.min(expiresIn, 1800) * 1000,
    }));
}
