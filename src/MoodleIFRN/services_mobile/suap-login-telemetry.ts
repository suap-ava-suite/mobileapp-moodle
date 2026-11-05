/* eslint-disable header/header */
import { CoreLogger } from '@static/logger';
import { CoreConstants } from '@/core/constants';

/** Instrumentação de duração do fluxo; não recebe nem registra dados do usuário. */
export const SUAP_TIMING_PREFIX = '[IFRN-SUAP-TIMING]';
export const FRESH_PROFILE_SKIP_KEY = 'ifrn_panel_profile_fresh_until';
const FRESH_PROFILE_SKIP_MAX_AGE_MS = 60_000;
const SAFE_STAGES = new Set([
    'marketplace-preflight', 'inappbrowser-open-call', 'browser-load-suap', 'browser-load-painel',
    'browser-load-other', 'suap-visible-wait', 'courses-api-response', 'panel-profile-api-response',
    'suap-profile-api-response', 'profile-api-response', 'courses-api-response-ttfb-approx',
    'panel-profile-api-response-ttfb-approx', 'suap-profile-api-response-ttfb-approx',
    'profile-api-response-ttfb-approx', 'browser-to-panel-data', 'suap-entry-to-validated-data',
    'panel-navigation-requested', 'panel-iframe-document-load', 'panel-templates-ready',
    'panel-dashboard-ready', 'panel-render-to-frame',
    'suap-browser-open-requested', 'suap-callback-to-profile-and-courses',
]);
const timingLogger = CoreLogger.getInstance('SuapLoginTiming');

export type SuapTimingLogger = (line: string) => void;

/**
 * Registra somente uma etapa conhecida e sua duração numérica.
 *
 * @param stage Nome curto e sem dados de usuário.
 * @param durationMs Duração observada em milissegundos.
 * @param logger Destino dos logs seguros.
 */
export function reportSuapDuration(
    stage: string,
    durationMs: number,
    logger: SuapTimingLogger = line => timingLogger.info(line),
): void {
    if (CoreConstants.BUILD.isProduction || CoreConstants.BUILD.isTesting
        || !SAFE_STAGES.has(stage) || !Number.isFinite(durationMs) || durationMs < 0) {
        return;
    }

    logger(`${SUAP_TIMING_PREFIX} ${JSON.stringify({ stage, durationMs: Math.round(durationMs) })}`);
}

/**
 * Marca que o perfil veio do mesmo callback SUAP/Painel já concluído.
 *
 * @param owner Identidade SUAP validada para este perfil.
 * @param storage Armazenamento da sessão ativa.
 * @param now Relógio usado para testar o prazo.
 */
export function markFreshPanelProfile(owner: string, storage: Storage = sessionStorage, now = Date.now()): void {
    const normalizedOwner = owner.trim().toLowerCase();
    if (!normalizedOwner) {
        clearFreshPanelProfile(storage);

        return;
    }

    storage.setItem(FRESH_PROFILE_SKIP_KEY, JSON.stringify({
        owner: normalizedOwner,
        until: now + FRESH_PROFILE_SKIP_MAX_AGE_MS,
        verified: true,
    }));
}

/**
 * Consome a dispensa uma única vez; nunca deixa uma marca velha pular refresh futuro.
 *
 * @param owner Identidade SUAP atualmente validada.
 * @param storage Armazenamento da sessão ativa.
 * @param now Relógio usado para testar o prazo.
 * @returns Se a consulta pode ser dispensada uma única vez.
 */
export function consumeFreshPanelProfile(owner: string, storage: Storage = sessionStorage, now = Date.now()): boolean {
    const raw = storage.getItem(FRESH_PROFILE_SKIP_KEY);
    if (raw === null) {
        return false;
    }

    storage.removeItem(FRESH_PROFILE_SKIP_KEY);

    let record: { owner?: unknown; until?: unknown; verified?: unknown };
    try {
        record = JSON.parse(raw) as { owner?: unknown; until?: unknown; verified?: unknown };
    } catch {
        return false;
    }

    const until = record.until;
    const currentOwner = owner.trim().toLowerCase();

    return record.verified === true && typeof record.owner === 'string' && !!currentOwner && record.owner === currentOwner
        && Number.isSafeInteger(until) && Number(until) > now
        && Number(until) - now <= FRESH_PROFILE_SKIP_MAX_AGE_MS;
}

/**
 * Remove a marca quando uma nova autenticação começa, falha ou é cancelada.
 *
 * @param storage Armazenamento da sessão ativa.
 */
export function clearFreshPanelProfile(storage: Storage = sessionStorage): void {
    storage.removeItem(FRESH_PROFILE_SKIP_KEY);
}
