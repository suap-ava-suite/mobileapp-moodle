/* eslint-disable header/header */
import { OAUTH_PROFILE_KEY, readOAuthProfile } from './oauth-profile';

const NAME_KEYS = ['nome_exibicao', 'show_name', 'nome_usual', 'nome_social', 'nome_registro', 'nome_completo', 'nome'] as const;

/**
 * Atualiza nomes somente após resposta autenticada do ambiente solicitado.
 *
 * @param incoming Perfil recebido da API autenticada.
 * @param responseUrl URL final da resposta.
 * @param expectedOrigin Origem autorizada para o perfil atual.
 * @param allowLegacyOrigin Permite atualizar snapshots sem origem registrada.
 * @param onDisplayNameChanged Executa quando o nome visível realmente mudou.
 * @returns Se o nome visível foi alterado.
 */
export function refreshSavedProfileNames(
    incoming: Record<string, unknown>,
    responseUrl: string,
    expectedOrigin: string,
    allowLegacyOrigin = false,
    onDisplayNameChanged?: () => void,
): boolean {
    const snapshot = readOAuthProfile();
    const url = new URL(responseUrl);
    if (!snapshot || url.origin !== expectedOrigin || url.pathname !== '/api/v2/usuario/info/'
            || !Number.isSafeInteger(incoming['id']) || Number(incoming['id']) <= 0) {
        return false;
    }
    const identities = ['identificacao', 'matricula', 'username']
        .map(key => incoming[key]).filter(value => value !== undefined && value !== null && value !== '');
    if (!identities.length || identities.some(value => String(value).trim() !== snapshot.identity)) {
        return false;
    }
    const previousOrigin = snapshot.profile['_profile_origin'];
    if (previousOrigin ? previousOrigin !== expectedOrigin : !allowLegacyOrigin) {
        return false;
    }
    const profile = { ...snapshot.profile };
    const validName = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
    const getDisplayName = (value: Record<string, unknown>): string => {
        for (const key of NAME_KEYS) {
            if (validName(value[key])) {
                return value[key].replace(/\s+/g, ' ').trim();
            }
        }

        return '';
    };
    const previousDisplayName = getDisplayName(profile);
    if (!NAME_KEYS.some(key => validName(incoming[key]))) {
        return false;
    }
    // A resposta completa pode remover um nome oficial antigo: não o deixe sombrear campos novos.
    for (const key of NAME_KEYS) {
        delete profile[key];
        if (validName(incoming[key])) {
            profile[key] = incoming[key];
        }
    }
    profile['_profile_origin'] = expectedOrigin;
    profile['_name_source'] = 'GET /api/v2/usuario/info/';
    const displayNameChanged = getDisplayName(profile) !== previousDisplayName;
    // Sem mudança real, não grava quatro snapshots nem pede ao host para
    // recarregar o iframe inteiro (scripts, listas, fotos e estado dos filtros).
    const profileChanged = [...NAME_KEYS, '_profile_origin', '_name_source']
        .some(key => profile[key] !== snapshot.profile[key]);
    const currentProfile = profileChanged ? profile : snapshot.profile;
    const serialized = JSON.stringify({ ...snapshot, profile: currentProfile });
    const serializedProfile = JSON.stringify(currentProfile);
    for (const storage of [sessionStorage, localStorage]) {
        if (storage.getItem(OAUTH_PROFILE_KEY) !== serialized) {
            storage.setItem(OAUTH_PROFILE_KEY, serialized);
        }
        if (storage.getItem('ifrn_painel_profile') !== serializedProfile) {
            storage.setItem('ifrn_painel_profile', serializedProfile);
        }
    }
    if (displayNameChanged) {
        try {
            onDisplayNameChanged?.();
        } catch {
            // Profile persistence remains valid even if the optional refresh marker cannot be stored.
        }
    }

    return displayNameChanged;
}
