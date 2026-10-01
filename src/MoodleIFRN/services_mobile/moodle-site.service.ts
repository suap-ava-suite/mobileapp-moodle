// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Injectable, inject } from '@angular/core';
import { CoreSiteIdentityProvider } from '@classes/sites/unauthenticated-site';
import { NO_SITE_ID } from '@features/login/constants';
import { CoreCourseHelper } from '@features/course/services/course-helper';
import { CoreCourses, CoreEnrolledCourseData } from '@features/courses/services/courses';
import { CoreLoginHelper } from '@features/login/services/login-helper';
import { AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { CoreNavigator, CoreRedirectPayload } from '@services/navigator';
import { CoreSites, CoreSiteCheckResponse } from '@services/sites';
import { CoreSitesFactory } from '@services/sites-factory';
import { CoreCustomURLSchemes } from '@services/urlschemes';
import { CoreUrl } from '@static/url';
import { CoreEvents } from '@static/events';
import { CoreLogger } from '@static/logger';


export const IFRN_MOODLE_PRESENCIAL_URL = 'https://presencial.ava.ifrn.edu.br';


const OAUTH_PENDING_KEY = 'ifrn_moodle_oauth_pending';
const RESUME_OAUTH_KEY = 'ifrn_moodle_resume_oauth';
const PENDING_OPEN_COURSE_KEY = 'ifrn_moodle_pending_open_course';
/** Persiste mismatch Painel↔Moodle além do ciclo de logout/navegação. */
const IDENTITY_MISMATCH_KEY = 'ifrn_moodle_identity_mismatch';
const LOG_PREFIX = '[IFRN Moodle]';
/** Diagnóstico temporário do Teste A (sessão Moodle). Sem tokens. */
const SITE_LOG = '[IFRN-SITE]';
/** Diagnóstico temporário do Teste B (abrir curso). Sem tokens. */
const COURSE_LOG = '[IFRN-COURSE]';
/** Diagnóstico de correspondência Painel/SUAP ↔ Moodle. Sem username/tokens. */
const IDENTITY_LOG = '[IFRN-IDENTITY]';

/**
 * Origem do viewurl do diário NÃO é necessariamente um Moodle Mobile válido.
 * Mock local (127.0.0.1:8002) não tem tool_mobile_get_public_config / wstoken.
 * Para CoreSites usamos só hosts Moodle reais; localhost → Presencial.
 */
export function resolveMoodleSiteUrl(candidate?: string | null): string {
    if (!candidate) {
        return IFRN_MOODLE_PRESENCIAL_URL;
    }

    try {
        const url = new URL(candidate);
        const host = url.hostname.toLowerCase();

        if (
            host === 'localhost'
            || host === '127.0.0.1'
            || host === '10.0.2.2'
            || host.endsWith('.local')
            || host.endsWith('.localhost')
        ) {
            return IFRN_MOODLE_PRESENCIAL_URL;
        }

        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
            return IFRN_MOODLE_PRESENCIAL_URL;
        }

        return url.origin;
    } catch {
        return IFRN_MOODLE_PRESENCIAL_URL;
    }
}

/** Hostname + pathname only (nunca query/fragment — podem carregar token). */
function sanitizeUrlForLog(raw: string | undefined | null): { scheme?: string; host?: string; path?: string } {
    if (!raw) {
        return {};
    }

    try {
        // Custom schemes: moodlemobile://token=...
        const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(raw);
        const scheme = schemeMatch?.[1];

        if (scheme && scheme !== 'http' && scheme !== 'https') {
            const pathOnly = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[?#]/)[0];

            return {
                scheme,
                path: pathOnly.startsWith('token=')
                    ? 'token=(redacted)'
                    : pathOnly.startsWith('link=')
                        ? 'link=(redacted)'
                        : pathOnly.slice(0, 40),
            };
        }

        const url = new URL(raw);

        return {
            scheme: url.protocol.replace(':', ''),
            host: url.host,
            path: url.pathname,
        };
    } catch {
        return { path: '(unparseable)' };
    }
}

/** Log seguro de erro CoreSites / WS (nunca token). */
function logSiteError(stage: string, error: unknown, context?: Record<string, unknown>): void {
    const err = error as {
        message?: string;
        critical?: boolean;
        debug?: { code?: string; details?: string };
        name?: string;
    } | null;

    // eslint-disable-next-line no-console
    console.error(SITE_LOG, stage, {
        ...context,
        errorName: err?.name || (error instanceof Error ? error.constructor.name : typeof error),
        message: err?.message || (error instanceof Error ? error.message : String(error)),
        critical: err?.critical,
        debugCode: err?.debug?.code,
        debugDetails: err?.debug?.details,
    });
}

/** Normaliza username Moodle/SUAP para comparação (sem logar o valor). */
function normalizeIdentity(value: string | null | undefined): string | null {
    const trimmed = (value || '').trim().toLowerCase();

    return trimmed || null;
}

/**
 * Fingerprint opaco (len + hash) — correlacionar nos logs sem expor matrícula.
 */
function identityFingerprint(value: string | null | undefined): string | null {
    const n = normalizeIdentity(value);

    if (!n) {
        return null;
    }

    let h = 2166136261;

    for (let i = 0; i < n.length; i++) {
        h ^= n.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }

    return `L${n.length}:${(h >>> 0).toString(16)}`;
}

/**
 * Classificação estrutural segura — sem caracteres do identificador.
 */
function identityShape(value: string | null | undefined): {
    available: boolean;
    length: number | null;
    shape: string | null;
} {
    const n = normalizeIdentity(value);

    if (!n) {
        return { available: false, length: null, shape: null };
    }

    let shape: string;

    if (/^\d+$/.test(n)) {
        shape = 'digits-only';
    } else if (n.includes('@')) {
        shape = 'email-like';
    } else if (/^[\d.\-/]+$/.test(n)) {
        shape = 'digits-with-separators';
    } else if (/^[a-z]+$/.test(n)) {
        shape = 'letters-only';
    } else if (/^[a-z0-9]+$/.test(n)) {
        shape = 'alphanumeric';
    } else {
        shape = 'mixed-other';
    }

    return { available: true, length: n.length, shape };
}

function identitiesMatch(
    expected: string | null | undefined,
    actual: string | null | undefined,
): boolean {
    const a = normalizeIdentity(expected);
    const b = normalizeIdentity(actual);

    return !!a && !!b && a === b;
}

/**
 * Log Identity seguro: Android/WebView costuma imprimir objetos como [object Object].
 * Só aceita payloads já sanitizados (sem username/matrícula/token).
 */
function identityLog(message: string, safePayload?: Record<string, unknown>): void {
    if (safePayload === undefined) {
        // eslint-disable-next-line no-console
        console.log(IDENTITY_LOG, message);

        return;
    }

    // eslint-disable-next-line no-console
    console.log(IDENTITY_LOG, message, JSON.stringify(safePayload));
}

/**
 * Identificadores da MESMA sessão autenticada SUAP/Painel.
 *
 * Evidência de que pertencem à mesma pessoa: todos vêm do login atual
 * (ifrn_username e/ou perfil/username retornado pelo Painel AVA → SUAP meus-dados).
 *
 * NÃO inclui nome, e-mail nem tokens.
 * Ordem: matrícula primeiro (alinhada ao username Moodle IFRN típico).
 */
function collectAllIdentityCandidates(
    authUsername: string | null | undefined,
    profile: Record<string, unknown> | null,
): { key: string; value: string }[] {
    const out: { key: string; value: string }[] = [];
    const seen = new Set<string>();

    const add = (key: string, raw: unknown): void => {
        if (typeof raw !== 'string' && typeof raw !== 'number') {
            return;
        }

        const value = normalizeIdentity(String(raw));

        if (!value || seen.has(value)) {
            return;
        }

        seen.add(value);
        out.push({ key, value });
    };

    // Perfil SUAP (via Painel authenticate.data) — campos oficiais do meus-dados.
    add('perfil.matricula', profile?.['matricula']);
    add('perfil.username', profile?.['username']);
    add('perfil.identificacao', profile?.['identificacao']);
    // CPF: mesmo perfil autenticado; Moodle pode usar CPF para alguns vínculos.
    add('perfil.cpf', profile?.['cpf']);

    // Login IFRN: pode ser matrícula OU CPF digitado / ecoado pelo token/pair.
    add('suap-auth.ifrn_username', authUsername);

    return out;
}

export type MoodleIdentityMatchResult = {
    matches: boolean;
    matchedVia: string | null;
    candidateCount: number;
    hasExpected: boolean;
};

/**
 * Chaves "fortes": identidade de conta SUAP/Painel (matrícula etc.).
 * CPF é fraco: a mesma pessoa pode ter conta ALUNO e ESTAGIÁRIO com o mesmo CPF
 * e Moodle usernames diferentes — CPF-only geraria falso positivo na conta errada.
 */
const STRONG_IDENTITY_KEYS = new Set([
    'perfil.matricula',
    'perfil.username',
    'perfil.identificacao',
    'suap-auth.ifrn_username',
]);

/**
 * True se o username Moodle coincide com a identidade da sessão Painel/SUAP.
 *
 * Preferência: matrícula / username / identificação / ifrn_username.
 * CPF só entra se NÃO houver matrícula no perfil (ex.: login só com CPF).
 */
function matchMoodleAgainstCandidates(
    moodleUsername: string | null | undefined,
    candidates: { key: string; value: string }[],
): MoodleIdentityMatchResult {
    if (!candidates.length) {
        return {
            matches: false,
            matchedVia: null,
            candidateCount: 0,
            hasExpected: false,
        };
    }

    const strong = candidates.filter((c) => STRONG_IDENTITY_KEYS.has(c.key));
    const weak = candidates.filter((c) => !STRONG_IDENTITY_KEYS.has(c.key));
    const hasMatricula = strong.some((c) => c.key === 'perfil.matricula');

    for (const candidate of strong) {
        if (identitiesMatch(candidate.value, moodleUsername)) {
            return {
                matches: true,
                matchedVia: candidate.key,
                candidateCount: candidates.length,
                hasExpected: true,
            };
        }
    }

    // Matrícula presente e nenhum id forte bateu → NÃO aceitar só CPF
    // (evita ALUNO no Painel + sessão Moodle ESTAGIÁRIO pelo CPF compartilhado).
    if (hasMatricula) {
        return {
            matches: false,
            matchedVia: null,
            candidateCount: candidates.length,
            hasExpected: true,
        };
    }

    for (const candidate of weak) {
        if (identitiesMatch(candidate.value, moodleUsername)) {
            return {
                matches: true,
                matchedVia: candidate.key,
                candidateCount: candidates.length,
                hasExpected: true,
            };
        }
    }

    return {
        matches: false,
        matchedVia: null,
        candidateCount: candidates.length,
        hasExpected: true,
    };
}

export type MoodleIdentityEnsureResult =
    | 'matched-current'
    | 'loaded-stored'
    | 'need-oauth'
    | 'oauth-mismatch';

export interface MoodlePendingOpenCourse {
    courseId: number;
    siteUrl?: string;
    courseName?: string;
}

export interface MoodleCourseSummary {
    id: number;
    name: string;
}

export interface MoodleSessionSummary {
    userFullName: string;
    username: string;
    siteUrl: string;
    siteName: string;
    courseCount: number;
    courses: MoodleCourseSummary[];
    openedCourseId?: number;
}

/**
 * Autentica no AVA via OAuth SUAP do próprio Moodle
 * e reutiliza CoreSites / CoreCourses / CoreCourseHelper do núcleo.
 *
 * Não usa o JWT do SUAP do AuthService.
 */
@Injectable({
    providedIn: 'root',
})
export class MoodleSiteService {

    private readonly logger = CoreLogger.getInstance('MoodleSiteService');
    private readonly authService = inject(AuthService);
    private readonly painelAva = inject(PainelAvaService);

    /** Último resumo da sessão Moodle. */
    lastSummary: MoodleSessionSummary | null = null;

    /** Último erro amigável do fluxo Moodle. */
    lastError = '';

    /**
     * True após mismatch de identidade (Caso B): a página NÃO deve auto-iniciar OAuth.
     * O usuário toca em “Entrar com outra conta SUAP” conscientemente.
     */
    identityMismatchPending = false;

    /** Impede dois openBrowserForOAuthLogin em paralelo / reentrância. */
    private oauthFlowActive = false;

    private loginObserverRegistered = false;

    /** Lê flag persistida de mismatch (sobrevive a logout/navegação). */
    isIdentityMismatchPending(): boolean {
        return this.identityMismatchPending
            || sessionStorage.getItem(IDENTITY_MISMATCH_KEY) === '1';
    }

    /** Marca / limpa mismatch Painel↔Moodle (memória + sessionStorage). */
    setIdentityMismatchPending(pending: boolean): void {
        this.identityMismatchPending = pending;

        if (pending) {
            sessionStorage.setItem(IDENTITY_MISMATCH_KEY, '1');
        } else {
            sessionStorage.removeItem(IDENTITY_MISMATCH_KEY);
        }
    }

    /**
     * Garante o listener de LOGIN (retorno do OAuth) e diagnóstico do deep link.
     */
    ensureLoginObserver(): void {
        if (this.loginObserverRegistered) {
            return;
        }

        this.loginObserverRegistered = true;

        // Retorno oficial: handleOpenURL → APP_LAUNCHED_URL → validateBrowserSSOLogin → newSite.
        // SSO NÃO usa CoreSites.getUserToken(); o wstoken vem no moodlemobile://token=...
        CoreEvents.on(CoreEvents.APP_LAUNCHED_URL, (data) => {
            const url = data?.url || '';
            // eslint-disable-next-line no-console
            console.log(SITE_LOG, 'callback deep link APP_LAUNCHED_URL', {
                ...sanitizeUrlForLog(url),
                isCustomURL: CoreCustomURLSchemes.isCustomURL(url),
                isSSOToken: CoreCustomURLSchemes.isCustomURLToken(url),
                // SSO: token embutido no scheme — não chama getUserToken
                expectsNewSite: CoreCustomURLSchemes.isCustomURLToken(url),
            });
            identityLog('callback recebido', {
                isSSOToken: CoreCustomURLSchemes.isCustomURLToken(url),
                pendingOAuth: sessionStorage.getItem(OAUTH_PENDING_KEY) === '1',
            });
        });

        // Se algo ainda abrir InAppBrowser, registrar eventos sem query.
        CoreEvents.on(CoreEvents.IAB_LOAD_START, (event) => {
            // eslint-disable-next-line no-console
            console.log(SITE_LOG, 'IAB loadstart', sanitizeUrlForLog(event?.url));
        });
        CoreEvents.on(CoreEvents.IAB_LOAD_STOP, (event) => {
            // eslint-disable-next-line no-console
            console.log(SITE_LOG, 'IAB loadstop', sanitizeUrlForLog(event?.url));
        });
        CoreEvents.on(CoreEvents.IAB_EXIT, () => {
            // eslint-disable-next-line no-console
            console.log(SITE_LOG, 'IAB exit');
        });

        CoreEvents.on(CoreEvents.LOGIN, () => {
            const site = CoreSites.getCurrentSite();
            const match = this.matchCurrentMoodleIdentity();

            // eslint-disable-next-line no-console
            console.log(SITE_LOG, 'CoreEvents.LOGIN — sessão Moodle', JSON.stringify({
                isLoggedIn: CoreSites.isLoggedIn(),
                siteUrl: site?.getURL() || null,
                siteIdPresent: !!site?.getId(),
                pendingOAuth: sessionStorage.getItem(OAUTH_PENDING_KEY) === '1',
                note: 'SSO usa newSite(token do deep link), não getUserToken',
            }));
            identityLog('nova sessão Moodle criada', {
                siteIdPresent: !!site?.getId(),
                hasExpected: match.hasExpected,
                candidateCount: match.candidateCount,
                matchedVia: match.matchedVia,
            });
            identityLog(`nova sessão corresponde = ${match.matches}`);

            this.logIdentityDiagnostics('CoreEvents.LOGIN');

            if (sessionStorage.getItem(OAUTH_PENDING_KEY) !== '1') {
                this.oauthFlowActive = false;

                return;
            }

            sessionStorage.removeItem(OAUTH_PENDING_KEY);

            // Deixa o núcleo concluir navigateToSiteHome e depois volta ao bridge IFRN
            // ou abre o curso pendente (fluxo do painel).
            window.setTimeout(() => {
                void this.afterOAuthLogin();
            }, 800);
        });
    }

    /**
     * Agenda abertura de um courseid Moodle após OAuth (ou imediatamente se já houver sessão).
     */
    setPendingOpenCourse(pending: MoodlePendingOpenCourse): void {
        const normalized: MoodlePendingOpenCourse = {
            ...pending,
            siteUrl: resolveMoodleSiteUrl(pending.siteUrl),
        };

        sessionStorage.setItem(PENDING_OPEN_COURSE_KEY, JSON.stringify(normalized));
    }

    getPendingOpenCourse(): MoodlePendingOpenCourse | null {
        const raw = sessionStorage.getItem(PENDING_OPEN_COURSE_KEY);

        if (!raw) {
            return null;
        }

        try {
            const parsed = JSON.parse(raw) as MoodlePendingOpenCourse;

            if (!parsed || typeof parsed.courseId !== 'number' || parsed.courseId <= 0) {
                return null;
            }

            return {
                ...parsed,
                siteUrl: resolveMoodleSiteUrl(parsed.siteUrl),
            };
        } catch {
            return null;
        }
    }

    clearPendingOpenCourse(): void {
        sessionStorage.removeItem(PENDING_OPEN_COURSE_KEY);
    }

    /**
     * Fluxo de produção: diário.id → sessão Moodle correta → abrir courseid nativo.
     * Só reutiliza sessão se a identidade Painel ↔ Moodle coincidir.
     * Pending (courseId/siteUrl/courseName) sobrevive ao OAuth em sessionStorage.
     *
     * Quando não há sessão correspondente, retorna `need-connect` sem iniciar o
     * OAuth — a UI (moodle-open-course) mostra “Entrar com SUAP” e só então chama
     * startSuapOAuthLogin(). Assim a segunda autenticação fica explícita.
     */
    async ensureSessionAndOpenCourse(
        courseId: number,
        siteUrl?: string,
        courseName?: string,
    ): Promise<'opened' | 'need-connect'> {
        this.ensureLoginObserver();
        this.lastError = '';

        // eslint-disable-next-line no-console
        console.log(COURSE_LOG, 'courseId recebido do Painel =', courseId);

        this.setPendingOpenCourse({ courseId, siteUrl, courseName });

        const identityResult = await this.ensureMatchingMoodleSession(siteUrl);

        if (identityResult === 'matched-current' || identityResult === 'loaded-stored') {
            await this.openCourseById(courseId);
            this.clearPendingOpenCourse();

            return 'opened';
        }

        // eslint-disable-next-line no-console
        console.log(COURSE_LOG, 'sessão Moodle ausente — aguardando Entrar com SUAP');

        return 'need-connect';
    }

    /**
     * Identidade canônica preferida (matrícula do perfil > ifrn_username > outros).
     * Para MATCH use matchCurrentMoodleIdentity() — qualquer candidato da sessão.
     */
    getExpectedPainelIdentity(): string | null {
        return this.describeExpectedIdentity().value;
    }

    /** Todos os identificadores confiáveis da sessão Painel/SUAP atual. */
    getExpectedIdentityCandidates(): { key: string; value: string }[] {
        return collectAllIdentityCandidates(
            this.authService.getUsername(),
            this.painelAva.getProfile(),
        );
    }

    /**
     * Compara username Moodle com qualquer identificador da mesma sessão autenticada.
     */
    matchCurrentMoodleIdentity(): MoodleIdentityMatchResult {
        return matchMoodleAgainstCandidates(
            this.getCurrentMoodleIdentity(),
            this.getExpectedIdentityCandidates(),
        );
    }

    /**
     * Descreve identidade canônica preferida (sem logar o valor).
     * Preferência: perfil.matricula (username Moodle IFRN típico) → auth → resto.
     */
    describeExpectedIdentity(): {
        value: string | null;
        source: 'painel-profile' | 'suap-auth' | 'none';
        field: string | null;
    } {
        const candidates = this.getExpectedIdentityCandidates();
        const preferred = candidates.find((c) => c.key === 'perfil.matricula')
            ?? candidates.find((c) => c.key === 'suap-auth.ifrn_username')
            ?? candidates[0];

        if (!preferred) {
            return { value: null, source: 'none', field: null };
        }

        if (preferred.key.startsWith('perfil.')) {
            return {
                value: preferred.value,
                source: 'painel-profile',
                field: preferred.key.replace(/^perfil\./, ''),
            };
        }

        return {
            value: preferred.value,
            source: 'suap-auth',
            field: 'ifrn_username',
        };
    }

    /** Username da sessão Moodle current (sanitizado). */
    getCurrentMoodleIdentity(): string | null {
        const site = CoreSites.getCurrentSite();

        if (!site || !CoreSites.isLoggedIn() || site.isLoggedOut()) {
            return null;
        }

        return normalizeIdentity(site.getInfo()?.username);
    }

    /**
     * Diagnóstico estrutural Painel/SUAP ↔ Moodle (sem valores reais).
     */
    private logIdentityDiagnostics(stage: string): void {
        const described = this.describeExpectedIdentity();
        const moodleUsername = this.getCurrentMoodleIdentity();
        const site = CoreSites.getCurrentSite();
        const info = site?.getInfo();
        const candidates = this.getExpectedIdentityCandidates();
        const match = matchMoodleAgainstCandidates(moodleUsername, candidates);
        const moodle = identityShape(moodleUsername);
        const preferred = identityShape(described.value);

        const candidateVsMoodle = candidates.map((c) => {
            const cShape = identityShape(c.value);

            return {
                key: c.key,
                matchesMoodle: identitiesMatch(c.value, moodleUsername),
                sameLength: !!(cShape.length && moodle.length && cShape.length === moodle.length),
                sameShape: !!(cShape.shape && moodle.shape && cShape.shape === moodle.shape),
            };
        });

        identityLog('comparador', {
            stage,
            preferredSource: described.source,
            preferredField: described.field,
            preferredLength: preferred.length,
            preferredShape: preferred.shape,
            moodleUsernameAvailable: moodle.available,
            moodleLength: moodle.length,
            moodleShape: moodle.shape,
            moodleUserIdPresent: typeof info?.userid === 'number' && info.userid > 0,
            normalizacao: 'trim+toLowerCase',
            matchMode: 'strong-first-no-cpf-if-matricula',
            candidateKeys: candidates.map((c) => c.key),
            candidateCount: candidates.length,
            corresponde: match.matches,
            matchedVia: match.matchedVia,
            authAloneWouldMatch: candidateVsMoodle.find(
                (c) => c.key === 'suap-auth.ifrn_username',
            )?.matchesMoodle ?? null,
            matriculaWouldMatch: candidateVsMoodle.find(
                (c) => c.key === 'perfil.matricula',
            )?.matchesMoodle ?? null,
            cpfWouldMatchButIgnoredIfMatricula: candidateVsMoodle.find(
                (c) => c.key === 'perfil.cpf',
            )?.matchesMoodle ?? null,
            candidateVsMoodle,
        });
    }

    /**
     * True se há sessão no site E a identidade bate com algum id da sessão Painel/SUAP.
     */
    hasMatchingPresencialSession(siteUrl = IFRN_MOODLE_PRESENCIAL_URL): boolean {
        if (!this.hasPresencialSession(siteUrl)) {
            return false;
        }

        const match = this.matchCurrentMoodleIdentity();

        if (!match.hasExpected) {
            // O Marketplace/Painel pode autenticar só por cookie e não expor matrícula.
            // Nesse caso não inventamos uma identidade a partir do nome: reutilizamos
            // a sessão Moodle válida do MESMO site e a abertura do curso ainda exige
            // que o courseId esteja entre os cursos matriculados da sessão atual.
            identityLog('sem identificador forte do Painel — sessão Moodle do site será reutilizada');

            return true;
        }

        return match.matches;
    }

    /**
     * Decide se reutiliza current, carrega site armazenado da mesma conta, ou precisa OAuth.
     */
    async ensureMatchingMoodleSession(
        siteUrl = IFRN_MOODLE_PRESENCIAL_URL,
    ): Promise<MoodleIdentityEnsureResult> {
        const resolved = resolveMoodleSiteUrl(siteUrl);
        const current = CoreSites.getCurrentSite();
        const hasSession = this.hasPresencialSession(resolved);
        const match = this.matchCurrentMoodleIdentity();

        const storedCount = (await CoreSites.getSiteIdsFromUrl(resolved)).length;

        identityLog('sessão Moodle existente', {
            hasSession,
            isLoggedIn: CoreSites.isLoggedIn(),
            siteUrl: current?.getURL() || null,
            siteIdPresent: !!current?.getId(),
            hasExpected: match.hasExpected,
            candidateCount: match.candidateCount,
            storedSitesForUrl: storedCount,
        });
        identityLog(`sessão existente corresponde = ${hasSession && match.matches}`);

        // Caso A = CoreSites já logado com OUTRA conta no mesmo siteUrl.
        // Caso B = sem sessão útil; OAuth vai ao browser (cookies SUAP podem forçar outra conta).
        identityLog('diagnóstico origem', {
            caseA_storedWrongAccount: !!(hasSession && match.hasExpected && !match.matches),
            caseB_needsBrowserOAuth: !(hasSession && match.matches),
            multiAccountSitesForUrl: storedCount,
        });

        this.logIdentityDiagnostics('ensureMatchingMoodleSession');

        if (hasSession && (match.matches || !match.hasExpected)) {
            identityLog('sessão correta definida como current', {
                source: match.matches ? 'reuse-current' : 'reuse-current-no-painel-identifier',
                matchedVia: match.matchedVia,
                identityVerified: match.matches,
            });

            return 'matched-current';
        }

        if (hasSession && match.hasExpected && !match.matches) {
            identityLog('sessão rejeitada por identidade diferente', {
                source: 'CoreSites-current',
                caseHint: match.hasExpected ? 'A-CoreSites-wrong-account' : 'sem-expected',
                hasExpected: match.hasExpected,
            });
        }

        // Conta correta pode estar armazenada (multi-account no mesmo siteUrl).
        let storedMatchingLoggedOut = false;

        if (match.hasExpected) {
            const storedId = await this.findStoredSiteIdForExpectedIdentities(resolved);

            if (storedId) {
                identityLog('site armazenado com identidade correspondente', {
                    siteIdPresent: true,
                });

                // Não chamar loadSite() em conta logged-out: o Core seta currentSite,
                // dispara SESSION_EXPIRED e pode redirecionar para /login/reconnect.
                const storedSite = await CoreSites.getSite(storedId);
                const storedIsLoggedOut = storedSite.isLoggedOut();

                identityLog('estado do site armazenado correspondente', {
                    siteIdPresent: true,
                    loggedOut: storedIsLoggedOut,
                });

                if (storedIsLoggedOut) {
                    storedMatchingLoggedOut = true;
                    identityLog(
                        'conta armazenada correspondente está logged-out — OAuth necessário (não descarta sessão válida)',
                        { siteIdPresent: true },
                    );
                } else {
                    const loaded = await CoreSites.loadSite(storedId);

                    if (loaded && this.hasMatchingPresencialSession(resolved)) {
                        const loadedMatch = this.matchCurrentMoodleIdentity();
                        identityLog('sessão correta definida como current', {
                            source: 'loadSite-stored',
                            matchedVia: loadedMatch.matchedVia,
                        });

                        return 'loaded-stored';
                    }

                    identityLog('loadSite da conta correspondente falhou', {
                        loadSiteReturned: loaded,
                        hasMatchingAfterLoad: this.hasMatchingPresencialSession(resolved),
                    });
                }
            }
        }

        const oauthReason = hasSession
            ? 'identity-mismatch-current'
            : (storedMatchingLoggedOut ? 'stored-matching-logged-out' : 'no-session');

        identityLog('OAuth necessário', {
            reason: oauthReason,
            storedMatchingLoggedOut,
            oauthFlowActive: this.oauthFlowActive,
        });

        return 'need-oauth';
    }

    /**
     * Procura siteId Moodle já salvo cujo username bata com qualquer id da sessão Painel/SUAP.
     * CoreSites: siteId = md5(siteUrl + username) — multi-conta no mesmo host.
     */
    private async findStoredSiteIdForExpectedIdentities(
        siteUrl: string,
    ): Promise<string | undefined> {
        const candidates = this.getExpectedIdentityCandidates();
        const ids = await CoreSites.getSiteIdsFromUrl(siteUrl);

        if (!candidates.length || !ids.length) {
            return undefined;
        }

        // O siteId do Moodle Mobile é md5(siteUrl + username). Em alguns retornos
        // ao mobilemoodle o CoreSite armazenado ainda não expõe getInfo().username,
        // embora a conta exista no banco. Primeiro resolvemos a conta pelo próprio
        // siteId, sem ativar uma conta diferente.
        const strong = candidates.filter((candidate) => STRONG_IDENTITY_KEYS.has(candidate.key));
        const hasMatricula = strong.some((candidate) => candidate.key === 'perfil.matricula');
        const allowedCandidates = hasMatricula
            ? strong
            : [...strong, ...candidates.filter((candidate) => !STRONG_IDENTITY_KEYS.has(candidate.key))];

        for (const candidate of allowedCandidates) {
            const candidateSiteId = CoreSites.createSiteID(siteUrl, candidate.value);

            if (ids.includes(candidateSiteId)) {
                identityLog('site armazenado localizado pelo siteId', {
                    matchedVia: candidate.key,
                    siteIdPresent: true,
                });

                return candidateSiteId;
            }
        }

        // Compatibilidade: se o siteId não puder ser reproduzido (URL histórica
        // normalizada de forma diferente), tenta o username salvo no CoreSite.
        for (const id of ids) {
            try {
                const site = await CoreSites.getSite(id);
                const username = normalizeIdentity(site.getInfo()?.username);
                const hit = matchMoodleAgainstCandidates(username, candidates);

                identityLog('candidato Moodle armazenado inspecionado', {
                    usernameAvailable: !!username,
                    loggedOut: site.isLoggedOut(),
                    matches: hit.matches,
                    matchedVia: hit.matchedVia,
                });

                if (hit.matches && !site.isLoggedOut()) {
                    return id;
                }
            } catch {
                // Site corrompido / sem token — ignora e deixa OAuth ser o fallback.
            }
        }

        return undefined;
    }

    /**
     * Abre um courseid específico entregando ao Moodle Mobile nativo.
     *
     * Fora do main menu (ex.: /login/moodle-open-course), usa o mesmo padrão
     * do deep link oficial: navigateToSitePath + reset → /main → getAndOpenCourse.
     * Assim a página intermediária NÃO fica na stack cobrindo a UI nativa.
     *
     * Dentro do main menu: CoreCourseHelper.getAndOpenCourse (igual “Meus cursos”).
     * Só abre se course.id === courseId em getUserCourses(). Sem aproximação por nome.
     */
    async openCourseById(courseId: number): Promise<number> {
        this.lastError = '';

        const match = this.matchCurrentMoodleIdentity();

        if (!CoreSites.isLoggedIn()) {
            throw new Error('Não há sessão Moodle ativa.');
        }

        if (match.hasExpected && !match.matches) {
            throw new Error(
                'Sessão Moodle não corresponde à conta do Painel — não é seguro abrir o curso.',
            );
        }

        if (!match.hasExpected) {
            // O fluxo Marketplace → Painel não expõe necessariamente matrícula/username.
            // Sem identificador forte não fazemos comparação por nome. A sessão precisa
            // estar autenticada e o courseId exato ainda será validado em getUserCourses().
            identityLog('abertura sem identificador forte do Painel', {
                source: 'moodle-session+exact-enrolment-check',
                siteIdPresent: !!CoreSites.getCurrentSiteId(),
            });
        }

        if (!Number.isFinite(courseId) || courseId <= 0) {
            throw new Error('Identificador de curso Moodle inválido.');
        }

        // eslint-disable-next-line no-console
        console.log(COURSE_LOG, 'courseId recebido do Painel =', courseId);
        // eslint-disable-next-line no-console
        console.log(COURSE_LOG, 'sessão/identidade OK', JSON.stringify({
            isLoggedIn: true,
            matchedVia: match.matchedVia,
            siteUrl: CoreSites.getCurrentSite()?.getURL() || null,
            siteIdPresent: !!CoreSites.getCurrentSiteId(),
        }));

        let courses: MoodleCourseSummary[];

        try {
            const enrolled = await CoreCourses.getUserCourses();
            courses = enrolled.map((course) => this.toCourseSummary(course));
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(COURSE_LOG, 'buscar cursos erro', {
                message: error instanceof Error ? error.message : String(error),
            });

            throw error instanceof Error
                ? error
                : new Error('Falha ao listar cursos matriculados no Moodle.');
        }

        // eslint-disable-next-line no-console
        console.log(COURSE_LOG, 'quantidade de cursos Moodle =', courses.length);

        const found = courses.some((course) => course.id === courseId);

        // eslint-disable-next-line no-console
        console.log(COURSE_LOG, 'courseId encontrado =', found);

        if (!found) {
            const message =
                `O curso ${courseId} não está entre os cursos matriculados nesta conta Moodle `
                + `(${courses.length} curso(s) encontrados). `
                + 'Nenhum outro curso foi aberto.';

            // eslint-disable-next-line no-console
            console.warn(COURSE_LOG, 'courseId não matriculado — abertura cancelada', {
                requested: courseId,
                enrolledCount: courses.length,
            });

            this.lastError = message;
            throw new Error(message);
        }

        const siteId = CoreSites.getCurrentSiteId();
        const onMainMenu = !!CoreNavigator.getCurrentMainMenuTab();

        // eslint-disable-next-line no-console
        console.log(COURSE_LOG, 'chamando getAndOpenCourse', JSON.stringify({
            courseId,
            siteIdPresent: !!siteId,
            onMainMenu,
            handoff: onMainMenu ? 'getAndOpenCourse' : 'navigateToSitePath-reset',
        }));

        try {
            if (!onMainMenu) {
                // Sai de /login/*, limpa stack (MoodleOpenCoursePage/overlays) e
                // deixa o MainMenuDeepLinkManager chamar getAndOpenCourse nativo.
                await CoreNavigator.navigateToSitePath(`course/${courseId}`, {
                    reset: true,
                    animated: false,
                });
            } else {
                await CoreCourseHelper.getAndOpenCourse(courseId, {}, siteId);
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(COURSE_LOG, 'getAndOpenCourse erro', {
                courseId,
                message: error instanceof Error ? error.message : String(error),
            });

            throw error;
        }

        // eslint-disable-next-line no-console
        console.log(COURSE_LOG, 'curso aberto', { courseId });

        if (this.lastSummary) {
            this.lastSummary.openedCourseId = courseId;
        } else {
            this.lastSummary = {
                userFullName: '',
                username: '',
                siteUrl: CoreSites.getCurrentSite()?.getURL() || '',
                siteName: '',
                courseCount: courses.length,
                courses,
                openedCourseId: courseId,
            };
        }

        return courseId;
    }

    /**
     * Há sessão Moodle ativa no site presencial?
     * (sessão restaurada pelo CoreSites — não implica OAuth do bridge IFRN).
     */
    hasPresencialSession(siteUrl = IFRN_MOODLE_PRESENCIAL_URL): boolean {
        const site = CoreSites.getCurrentSite();

        if (!site || !CoreSites.isLoggedIn() || site.isLoggedOut()) {
            return false;
        }

        return CoreUrl.sameDomainAndPath(site.getURL(), siteUrl);
    }

    /**
     * True quando o bridge pediu switch-account e deve retomar o OAuth ao voltar.
     */
    shouldResumeOAuthAfterSiteSwitch(): boolean {
        return sessionStorage.getItem(RESUME_OAUTH_KEY) === '1';
    }

    /**
     * Abre o OAuth SUAP do AVA-Presencial (identity provider do Moodle).
     *
     * Usa o fluxo OFICIAL: CoreLoginHelper.openBrowserForOAuthLogin
     * (= prepareForSSOLogin + openInBrowser no navegador do sistema).
     *
     * NÃO usa InAppBrowser: o retorno moodlemobile://token=… depende do
     * custom URL scheme (handleOpenURL → newSite). IAB não devolve isso ao app.
     *
     * SSO NÃO chama CoreSites.getUserToken(); o wstoken vem no deep link.
     *
     * @returns `switched` se pediu switch-account e vai retomar o OAuth;
     *          `opened` se o navegador OAuth foi aberto.
     */
    async startSuapOAuthLogin(
        options: { resumeAfterSwitch?: boolean } = {},
    ): Promise<'switched' | 'opened' | 'already-active'> {
        this.ensureLoginObserver();
        this.lastError = '';
        this.lastSummary = null;

        if (this.oauthFlowActive && !options.resumeAfterSwitch) {
            identityLog('OAuth ignorado — já existe fluxo ativo');

            return 'already-active';
        }

        const beforeMatch = this.matchCurrentMoodleIdentity();
        const currentSite = CoreSites.getCurrentSite();
        // loadSite() pode deixar uma conta armazenada como current mesmo se ela
        // estiver logged-out. Isso não representa uma sessão Moodle reutilizável.
        const hadSession = Boolean(
            currentSite
            && CoreSites.isLoggedIn()
            && !currentSite.isLoggedOut()
        );

        identityLog('OAuth iniciado', {
            resumeAfterSwitch: !!options.resumeAfterSwitch,
            hadSessionBefore: hadSession,
            hasExpected: beforeMatch.hasExpected,
            candidateCount: beforeMatch.candidateCount,
            sessionMatchedBefore: beforeMatch.matches,
            matchedViaBefore: beforeMatch.matchedVia,
            caseHint: hadSession && !beforeMatch.matches
                ? 'mismatch→OAuth'
                : 'fresh-or-resume',
        });

        // Mesmo padrão do Add site oficial: sair da sessão atual antes de
        // autenticar outra conta. Não apaga o site antigo nem o login IFRN.
        if (!options.resumeAfterSwitch && hadSession) {
            this.logger.debug(
                `${LOG_PREFIX} Sessão Moodle ativa — switch-account antes do OAuth SUAP`,
            );

            sessionStorage.setItem(RESUME_OAUTH_KEY, '1');

            const pending = this.getPendingOpenCourse();
            const redirectPath = pending?.courseId
                ? '/login/moodle-open-course'
                : '/login/moodle-open-course';
            const redirectOptions = pending?.courseId
                ? { params: { startOAuth: true, courseId: pending.courseId, courseName: pending.courseName } }
                : { params: { startOAuth: true } };

            await CoreSites.logout({
                siteId: NO_SITE_ID,
                redirectPath,
                redirectOptions,
            });

            return 'switched';
        }

        sessionStorage.removeItem(RESUME_OAUTH_KEY);

        const pending = this.getPendingOpenCourse();
        const rawCandidate = pending?.siteUrl;
        const targetSiteUrl = resolveMoodleSiteUrl(rawCandidate);

        // eslint-disable-next-line no-console
        console.log(SITE_LOG, 'startSuapOAuthLogin', {
            rawCandidate: rawCandidate || null,
            targetSiteUrl,
            courseId: pending?.courseId ?? null,
        });

        const siteCheck = await this.checkPresencialSite(targetSiteUrl);

        // eslint-disable-next-line no-console
        console.log(SITE_LOG, 'checkSite OK — próxima etapa: identity providers', {
            siteUrl: siteCheck.siteUrl,
            typeoflogin: siteCheck.code,
            hasConfig: !!siteCheck.config,
            enablemobilewebservice: siteCheck.config?.enablemobilewebservice,
        });

        const provider = await this.findSuapProvider(siteCheck);

        // eslint-disable-next-line no-console
        console.log(SITE_LOG, 'findSuapProvider', {
            found: !!provider,
            name: provider?.name || null,
            url: provider?.url ? sanitizeUrlForLog(provider.url) : null,
        });

        if (!provider) {
            throw new Error(
                'Identity provider SUAP não encontrado em tool_mobile_get_public_config.',
            );
        }

        const oauthParams = CoreUrl.extractUrlParams(provider.url);

        if (!oauthParams.id) {
            throw new Error('Identity provider SUAP sem parâmetro id na URL OAuth.');
        }

        sessionStorage.setItem(OAUTH_PENDING_KEY, '1');
        this.oauthFlowActive = true;
        this.setIdentityMismatchPending(false);

        const redirectData: CoreRedirectPayload | undefined = pending?.courseId
            ? {
                redirectPath: '/login/moodle-open-course',
                redirectOptions: {
                    params: {
                        courseId: pending.courseId,
                        courseName: pending.courseName,
                    },
                },
            }
            : undefined;

        // eslint-disable-next-line no-console
        console.log(SITE_LOG, 'openBrowserForOAuthLogin (fluxo oficial, NÃO InAppBrowser)', {
            siteUrl: siteCheck.siteUrl,
            oauthsso: oauthParams.id,
            launchurl: siteCheck.config?.launchurl
                ? sanitizeUrlForLog(siteCheck.config.launchurl)
                : null,
            redirectPath: redirectData?.redirectPath || null,
            note: 'Retorno esperado: moodlemobile://token=… → handleOpenURL → newSite',
        });

        const opened = await CoreLoginHelper.openBrowserForOAuthLogin(
            siteCheck.siteUrl,
            provider,
            siteCheck.config?.launchurl,
            redirectData,
        );

        // eslint-disable-next-line no-console
        console.log(SITE_LOG, 'openBrowserForOAuthLogin resultado', {
            opened,
            pendingOAuth: sessionStorage.getItem(OAUTH_PENDING_KEY) === '1',
        });

        if (!opened) {
            sessionStorage.removeItem(OAUTH_PENDING_KEY);
            this.oauthFlowActive = false;
            throw new Error('Não foi possível abrir o navegador para OAuth SUAP.');
        }

        return 'opened';
    }

    /**
     * checkSite no AVA-Presencial (public config + typeoflogin).
     * Esta é a etapa que dispara "We can't find the site you entered"
     * quando a URL não responde tool_mobile_get_public_config (ex.: mock :8002).
     */
    async checkPresencialSite(siteUrl = IFRN_MOODLE_PRESENCIAL_URL): Promise<CoreSiteCheckResponse> {
        const resolved = resolveMoodleSiteUrl(siteUrl);

        // eslint-disable-next-line no-console
        console.log(SITE_LOG, 'CoreSites.checkSite → getPublicConfig', {
            requested: siteUrl,
            resolved,
        });

        try {
            const result = await CoreSites.checkSite(
                resolved,
                'https://',
                'IFRN Moodle',
            );

            // eslint-disable-next-line no-console
            console.log(SITE_LOG, 'CoreSites.checkSite sucesso', {
                siteUrl: result.siteUrl,
                code: result.code,
            });

            return result;
        } catch (error) {
            logSiteError('CoreSites.checkSite FALHOU (origem tipica: getPublicConfig)', error, {
                resolved,
            });

            throw error;
        }
    }

    /**
     * Localiza o identity provider nomeado "suap" (oauth id=1 no AVA-Presencial).
     */
    async findSuapProvider(
        siteCheck: CoreSiteCheckResponse,
    ): Promise<CoreSiteIdentityProvider | undefined> {
        if (!siteCheck.config) {
            return undefined;
        }

        const tempSite = CoreSitesFactory.makeUnauthenticatedSite(
            siteCheck.siteUrl,
            siteCheck.config,
        );

        const providers = await CoreLoginHelper.getValidIdentityProvidersForSite(tempSite);

        const byName = providers.find(
            (provider) => provider.name.trim().toLowerCase() === 'suap',
        );

        if (byName) {
            return byName;
        }

        return providers.find(
            (provider) => Number(CoreUrl.extractUrlParams(provider.url).id) === 1,
        ) ?? providers[0];
    }

    /**
     * Após OAuth: valida identidade e abre automaticamente o courseId pendente.
     * O usuário NÃO precisa voltar ao Painel e clicar de novo.
     *
     * Conta diferente do Painel: NÃO abre o curso e NÃO aceita a identidade
     * retornada — mas NÃO destrói a sessão Moodle (sem forceLogout). A sessão
     * criada por newSite() permanece persistida para reutilização futura.
     */
    private async afterOAuthLogin(): Promise<void> {
        this.oauthFlowActive = false;

        const match = this.matchCurrentMoodleIdentity();
        const pending = this.getPendingOpenCourse();

        // eslint-disable-next-line no-console
        console.log(SITE_LOG, 'afterOAuthLogin — pós deep link / newSite', JSON.stringify({
            isLoggedIn: CoreSites.isLoggedIn(),
            siteUrl: CoreSites.getCurrentSite()?.getURL() || null,
            pendingCourseId: pending?.courseId ?? null,
        }));
        identityLog('afterOAuthLogin identidade', {
            corresponde: match.matches,
            matchedVia: match.matchedVia,
            hasExpected: match.hasExpected,
            candidateCount: match.candidateCount,
            caseHint: match.matches
                ? 'ok'
                : (match.hasExpected ? 'B-browser-SUAP-cookie-or-format' : 'sem-expected'),
        });

        this.logIdentityDiagnostics('afterOAuthLogin');

        // Tipicamente Caso B: cookie SUAP no Chrome ainda na conta errada.
        // Validação permanece; a sessão newSite() NÃO é destruída (sem forceLogout).
        if (match.hasExpected && !match.matches) {
            this.setIdentityMismatchPending(true);
            this.lastError =
                'Conta diferente detectada. '
                + 'O SUAP entrou com uma conta diferente da conta utilizada no Painel AVA. '
                + 'O curso não foi aberto. A sessão Moodle não foi apagada.';

            identityLog('nova sessão corresponde = false', {
                caseHint: 'B-browser-SUAP-cookie-or-format',
                action: 'reject-no-logout-preserve-session',
            });

            await CoreNavigator.navigate('/login/moodle-open-course', {
                animated: false,
                params: {
                    courseId: pending?.courseId,
                    courseName: pending?.courseName,
                    identityOnly: true,
                },
            });

            return;
        }

        if (!match.matches && match.hasExpected) {
            this.lastError = 'Não foi possível confirmar a identidade Moodle após o login.';

            await CoreNavigator.navigate('/login/moodle-open-course', {
                animated: false,
                params: {
                    courseId: pending?.courseId,
                    courseName: pending?.courseName,
                    identityOnly: true,
                },
            });

            return;
        }

        if (match.matches) {
            identityLog('nova sessão corresponde = true');
            identityLog('sessão correta definida como current', {
                source: 'oauth-newSite',
                matchedVia: match.matchedVia,
                identityVerified: true,
            });
        } else {
            // Sem matrícula/username forte vindo do Painel: não usar nome de exibição
            // como identidade. Aceita a sessão recém-criada pelo OAuth oficial e
            // valida o courseId exato contra os cursos matriculados antes de abrir.
            identityLog('OAuth concluído sem identificador forte do Painel', {
                source: 'oauth-newSite+exact-enrolment-check',
                identityVerified: false,
            });
        }
        this.setIdentityMismatchPending(false);
        this.lastError = '';

        if (!pending?.courseId) {
            this.lastError = 'Login Moodle OK, mas nenhum courseId pendente do Painel.';

            await CoreNavigator.navigate('/login/moodle-open-course', {
                animated: false,
                params: { identityOnly: true },
            });

            return;
        }

        try {
            await this.openCourseById(pending.courseId);
            this.clearPendingOpenCourse();
            // getAndOpenCourse já navega para o curso nativo.
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(COURSE_LOG, 'abrir curso pendente após OAuth falhou', {
                courseId: pending.courseId,
                message: error instanceof Error ? error.message : String(error),
            });
            this.lastError = error instanceof Error
                ? error.message
                : 'Falha ao abrir o curso Moodle após autenticação.';

            await CoreNavigator.navigate('/login/moodle-open-course', {
                animated: false,
                params: {
                    courseId: pending.courseId,
                    courseName: pending.courseName,
                    identityOnly: true,
                },
            });
        }
    }

    private toCourseSummary(course: CoreEnrolledCourseData): MoodleCourseSummary {
        return {
            id: course.id,
            name: course.displayname || course.fullname || course.shortname || `Curso ${course.id}`,
        };
    }


}
