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
import { NavigationEnd, NavigationError, Router } from '@angular/router';
import { CoreSiteIdentityProvider } from '@classes/sites/unauthenticated-site';
import { NO_SITE_ID } from '@features/login/constants';
import { MAIN_MENU_HOME_PAGE_NAME } from '@features/mainmenu/constants';
import { CoreCourseHelper } from '@features/course/services/course-helper';
import { CoreCourses, CoreEnrolledCourseData } from '@features/courses/services/courses';
import { CoreLoginHelper } from '@features/login/services/login-helper';
import { AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { showHandoffLoading, hideHandoffLoading } from '@/MoodleIFRN/navigation/handoff-loading';
import { isNativeMoodleLanding } from '@/MoodleIFRN/navigation/navigation-policy';
import { CoreNavigator, CoreRedirectPayload } from '@services/navigator';
import { CoreSites, CoreSiteCheckResponse } from '@services/sites';
import { CoreSitesFactory } from '@services/sites-factory';
import { CoreCustomURLSchemes } from '@services/urlschemes';
import { CoreUrl } from '@static/url';
import { CoreEvents } from '@static/events';
import { CoreLogger } from '@static/logger';
import { useIfrnBrazilianPortuguese } from './ifrn-language';


export const IFRN_MOODLE_PRESENCIAL_URL = 'https://presencial.ava.ifrn.edu.br';


const OAUTH_PENDING_KEY = 'ifrn_moodle_oauth_pending';
const RESUME_OAUTH_KEY = 'ifrn_moodle_resume_oauth';
const PENDING_OPEN_COURSE_KEY = 'ifrn_moodle_pending_open_course';
/** Persiste mismatch Painel↔Moodle além do ciclo de logout/navegação. */
const IDENTITY_MISMATCH_KEY = 'ifrn_moodle_identity_mismatch';
/** Curso aberto pelo fluxo Painel AVA → Voltar deve retornar ao Painel. */
const COURSE_ORIGIN_KEY = 'ifrn_course_origin';
const COURSE_ORIGIN_ID_KEY = 'ifrn_course_id';
const LOG_PREFIX = '[IFRN Moodle]';
/** Diagnóstico temporário do Teste A (sessão Moodle). Sem tokens. */
const SITE_LOG = '[IFRN-SITE]';
/** Diagnóstico temporário do Teste B (abrir curso). Sem tokens. */
const COURSE_LOG = '[IFRN-COURSE]';
/** Diagnóstico temporário da pilha curso↔Painel. Sem tokens. */
const COURSE_NAV_LOG = '[IFRN-COURSE-NAV]';
/** Diagnóstico de correspondência Painel/SUAP ↔ Moodle. Sem username/tokens. */
const IDENTITY_LOG = '[IFRN-IDENTITY]';

/**
 * Normaliza URL Angular/Ionic (sem query/hash; sem barra final).
 */
function normalizeAppPath(url: string): string {
    const pathOnly = (url || '').split(/[?#]/)[0] || '';

    if (!pathOnly || pathOnly === '/') {
        return pathOnly || '/';
    }

    return pathOnly.replace(/\/+$/, '') || '/';
}

/**
 * Página principal do curso (index + tabs contents/participants/…).
 * Exclui irmãos empilhados: summary, list-mod-type, {cmId}/module-preview.
 *
 * Exemplos true:
 *   /main/home/course/123
 *   /main/home/course/deep/123/contents
 * Exemplos false:
 *   /main/home/course/123/summary
 *   /main/home/course/123/456/module-preview
 *   /main/home/mod_forum/...
 */
function isCourseIndexPath(path: string, courseId: number): boolean {
    const normalized = normalizeAppPath(path);
    const match = normalized.match(
        new RegExp(`^/main/[^/]+/course(?:/deep)*/${courseId}(?:/([^/]+))?$`),
    );

    if (!match) {
        return false;
    }

    const rest = match[1];

    if (!rest) {
        return true;
    }

    // Rotas irmãs do index (não são a página principal do curso).
    if (rest === 'summary' || rest === 'list-mod-type' || /^\d+$/.test(rest)) {
        return false;
    }

    // Tab do course index: contents, participants, grades, overview, etc.
    return true;
}

/**
 * Raiz / landing do Main Menu (Dashboard, Site home, My courses…).
 * Não inclui /course/… nem atividades (mod_*, caminhos profundos).
 */
function isMainMenuLandingPath(path: string): boolean {
    const normalized = normalizeAppPath(path);

    if (!normalized.startsWith('/main')) {
        return false;
    }

    // Qualquer rota de curso não é landing.
    if (/\/course(?:\/|$)/.test(normalized)) {
        return false;
    }

    const parts = normalized.split('/').filter(Boolean);

    // /main | /main/{tab} | /main/{tab}/{page}
    if (parts[0] !== 'main') {
        return false;
    }

    if (parts.length > 3) {
        return false;
    }

    if (parts.some((part) => part.startsWith('mod_'))) {
        return false;
    }

    // Não tratar qualquer plugin/página curta como Dashboard.
    return parts.length <= 2 || ['dashboard', 'sitehome'].includes(parts[2]);
}

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
    console.error(SITE_LOG, stage, JSON.stringify({
        ...context,
        errorName: err?.name || (error instanceof Error ? error.constructor.name : typeof error),
        message: err?.message || (error instanceof Error ? error.message : String(error)),
        critical: err?.critical,
        debugCode: err?.debug?.code,
        debugDetails: err?.debug?.details,
    }));
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

/** O perfil do Painel define a conta solicitada; outro vínculo/CPF não a substitui. */
function allowedIdentityCandidates(candidates: { key: string; value: string }[]): { key: string; value: string }[] {
    const profileAccount = candidates.find((candidate) => candidate.key === 'perfil.matricula')
        ?? candidates.find((candidate) => candidate.key === 'perfil.username')
        ?? candidates.find((candidate) => candidate.key === 'perfil.identificacao');

    if (profileAccount) {
        return [profileAccount];
    }

    const authAccount = candidates.find((candidate) => candidate.key === 'suap-auth.ifrn_username');

    return authAccount ? [authAccount] : candidates;
}

/**
 * True se o username Moodle coincide com a identidade da sessão Painel/SUAP.
 *
 * Preferência: matrícula / username / identificação / ifrn_username.
 * CPF só entra quando não há identificador de conta do perfil nem do login.
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

    for (const candidate of allowedIdentityCandidates(candidates)) {
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
    private readonly router = inject(Router);

    /** Último resumo da sessão Moodle. */
    lastSummary: MoodleSessionSummary | null = null;

    /** Último erro amigável do fluxo Moodle. */
    lastError = '';

    /** Dados para a tela de recuperação; nunca contém senha ou token. */
    lastCourseAccessIssue: {
        kind: 'identity-mismatch' | 'not-enrolled';
        expectedLogin: string | null;
        actualLogin: string | null;
    } | null = null;

    private reportCourseAccessIssue(kind: 'identity-mismatch' | 'not-enrolled', courseId: number): string {
        const expectedLogin = this.describeExpectedIdentity().value;
        const actualLogin = this.getCurrentMoodleIdentity();
        this.oauthReturnNavigating = false;
        this.oauthCallbackReceived = false;
        this.oauthFlowActive = false;
        sessionStorage.removeItem(OAUTH_PENDING_KEY);
        this.hideNativeCourseHandoff();
        this.lastCourseAccessIssue = { kind, expectedLogin, actualLogin };
        this.clearCourseOriginFlags();

        if (kind === 'identity-mismatch') {
            this.setIdentityMismatchPending(true);
            this.lastError = 'O Moodle entrou com uma matrícula/login diferente da conta do Painel. '
                + 'O curso não foi aberto. Entre no SUAP com a matrícula utilizada no Painel.';
        } else {
            this.lastError = `A matrícula/login ${actualLogin || 'autenticada no Moodle'} não está vinculada ao curso ${courseId}`
                + ' na lista de cursos desta conta. Entre com a matrícula vinculada à disciplina '
                + 'ou verifique sua matrícula no curso.';
        }

        return this.lastError;
    }

    /** Troca o login do Painel por escolha explícita, mantendo os sites Moodle salvos. */
    async returnToIfrnLogin(): Promise<void> {
        const expectedLogin = this.describeExpectedIdentity().value;
        this.clearPendingOpenCourse();
        this.clearCourseOriginFlags();
        this.setIdentityMismatchPending(false);
        sessionStorage.removeItem(OAUTH_PENDING_KEY);
        sessionStorage.removeItem(RESUME_OAUTH_KEY);
        this.oauthFlowActive = false;
        this.oauthReturnNavigating = false;
        this.oauthCallbackReceived = false;
        this.hideNativeCourseHandoff();
        this.lastCourseAccessIssue = null;
        this.lastError = '';
        this.authService.logout();
        this.painelAva.clearSession();
        await CoreNavigator.navigate('/login/ifrn-login', {
            reset: true,
            animated: false,
            params: { forceLogin: true, username: expectedLogin || undefined },
        });
    }

    /**
     * True após mismatch de identidade (Caso B): a página NÃO deve auto-iniciar OAuth.
     * O usuário toca em “Entrar com outra conta SUAP” conscientemente.
     */
    identityMismatchPending = false;

    /** Impede dois openBrowserForOAuthLogin em paralelo / reentrância. */
    private oauthFlowActive = false;

    private loginObserverRegistered = false;

    /**
     * Observer de NavigationEnd para Painel→curso→Painel.
     * Criado no máximo uma vez (serviço root).
     */
    private courseNavObserverRegistered = false;

    /**
     * True só depois que a URL do course index do courseId marcado foi vista.
     * Evita redirecionar no salto intermediário /login → /main antes do curso abrir.
     */
    private courseOpenedFromPainel = false;

    /** URL anterior (path) para detectar saída course → main. */
    private previousCourseNavUrl = '';

    /** Evita redirect duplicado se NavigationEnd disparar em sequência. */
    private redirectingToPainel = false;

    /** Uma única abertura IFRN por vez, inclusive durante o retorno do OAuth. */
    private courseOpening: { courseId: number; promise: Promise<number> } | null = null;

    private navigationShellInitialized = false;
    private oauthReturnNavigating = false;
    private oauthCallbackReceived = false;

    private handoffTimeout: number | undefined;

    /** Limite também para o intervalo OAuth → ponte, antes de abrir o curso. */
    showNativeCourseHandoff(): void {
        showHandoffLoading();
        if (this.handoffTimeout !== undefined) {
            return;
        }
        this.handoffTimeout = window.setTimeout(() => {
            this.hideNativeCourseHandoff();
            this.oauthReturnNavigating = false;
            this.oauthCallbackReceived = false;
            this.oauthFlowActive = false;
            sessionStorage.removeItem(OAUTH_PENDING_KEY);
            this.lastError = 'Não foi possível concluir a abertura do curso. Tente novamente ou volte ao Painel.';
            const pending = this.getPendingOpenCourse();
            void CoreNavigator.navigate('/login/moodle-open-course', {
                animated: false,
                params: { courseId: pending?.courseId, courseName: pending?.courseName, identityOnly: true },
            }).catch((error) => {
                logSiteError('Falha ao mostrar recuperação do carregamento', error);
                this.redirectToPainelAva();
            });
        }, 60000);
    }

    hideNativeCourseHandoff(): void {
        if (this.handoffTimeout !== undefined) {
            window.clearTimeout(this.handoffTimeout);
            this.handoffTimeout = undefined;
        }
        hideHandoffLoading();
    }

    isNativeCourseHandoffActive(): boolean {
        return !!this.courseOpening || this.oauthReturnNavigating;
    }

    initializeIfrnNavigationShell(): void {
        if (this.navigationShellInitialized) {
            return;
        }

        this.navigationShellInitialized = true;
        document.documentElement.classList.add('ifrn-shell');
        this.ensureLoginObserver();
        this.ensureCourseNavObserver();
        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd && !isNativeMoodleLanding(event.urlAfterRedirects || event.url)) {
                this.hideNativeCourseHandoff();
            }
        });
    }

    /** Cancelamento explícito pelo usuário; nenhum redirecionamento automático. */
    dismissCourseRecovery(): void {
        this.clearPendingOpenCourse();
        this.clearCourseOriginFlags();
        this.setIdentityMismatchPending(false);
        sessionStorage.removeItem(OAUTH_PENDING_KEY);
        sessionStorage.removeItem(RESUME_OAUTH_KEY);
        this.oauthFlowActive = false;
        this.oauthReturnNavigating = false;
        this.oauthCallbackReceived = false;
        this.lastCourseAccessIssue = null;
        this.lastError = '';
        this.hideNativeCourseHandoff();
    }

    isCurrentSiteIfrn(): boolean {
        try {
            const host = new URL(CoreSites.getCurrentSite()?.getURL() || '').hostname;
            return host === 'ava.ifrn.edu.br' || host.endsWith('.ava.ifrn.edu.br');
        } catch {
            return false;
        }
    }

    /** Mantém a recuperação vinculada ao curso, mesmo após sua abertura. */
    getCourseRecoveryTarget(): MoodlePendingOpenCourse | null {
        const pending = this.getPendingOpenCourse();
        if (pending) {
            return pending;
        }
        const courseId = Number(sessionStorage.getItem(COURSE_ORIGIN_ID_KEY));
        if (!Number.isFinite(courseId) || courseId <= 0) {
            return null;
        }
        return { courseId, siteUrl: CoreSites.getCurrentSite()?.getURL() };
    }

    /** Entrada única IFRN após bloquear inicialização/retorno no Dashboard antigo. */
    async openIfrnEntry(): Promise<void> {
        const recovery = this.getCourseRecoveryTarget();
        if (this.isIdentityMismatchPending() && recovery) {
            this.hideNativeCourseHandoff();
            await CoreNavigator.navigate('/login/moodle-open-course', {
                animated: false,
                params: { courseId: recovery.courseId, courseName: recovery.courseName, identityOnly: true },
            });
            return;
        }
        this.clearCourseOriginFlags();
        this.clearPendingOpenCourse();
        this.setIdentityMismatchPending(false);
        sessionStorage.removeItem(OAUTH_PENDING_KEY);
        sessionStorage.removeItem(RESUME_OAUTH_KEY);
        this.oauthReturnNavigating = false;
        this.oauthCallbackReceived = false;
        this.oauthFlowActive = false;
        this.redirectingToPainel = false;
        this.hideNativeCourseHandoff();

        if (this.painelAva.hasDashboard()) {
            this.redirectToPainelAva();

            return;
        }

        // O login IFRN já verifica token/biometria; não usar a sessão Moodle
        // como prova de que há autenticação válida no Painel.
        await CoreNavigator.navigate('/login/ifrn-login', { reset: true, animated: false });
    }

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
            console.log(SITE_LOG, 'callback deep link APP_LAUNCHED_URL', JSON.stringify({
                ...sanitizeUrlForLog(url),
                isCustomURL: CoreCustomURLSchemes.isCustomURL(url),
                isSSOToken: CoreCustomURLSchemes.isCustomURLToken(url),
                // SSO: token embutido no scheme — não chama getUserToken
                expectsNewSite: CoreCustomURLSchemes.isCustomURLToken(url),
            }));
            identityLog('callback recebido', {
                isSSOToken: CoreCustomURLSchemes.isCustomURLToken(url),
                pendingOAuth: sessionStorage.getItem(OAUTH_PENDING_KEY) === '1',
            });
            if (CoreCustomURLSchemes.isCustomURLToken(url)
                && sessionStorage.getItem(OAUTH_PENDING_KEY) === '1'
                && this.getPendingOpenCourse()) {
                // Só o LOGIN nativo confirma que o token de retorno foi aceito.
                this.oauthCallbackReceived = true;
            }
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

            // LOGIN ocorre antes de urlschemes concluir navigateToSiteHome.
            // O redirectPath oficial retorna à ponte IFRN; somente ela retoma
            // o curso. Um timer aqui concorria com ngOnInit da ponte e com /main.
            this.oauthReturnNavigating = this.oauthCallbackReceived || this.oauthFlowActive;
            this.oauthCallbackReceived = false;
            this.oauthFlowActive = false;
        });
    }

    /** Consome o retorno OAuth apenas quando a ponte oficial estiver ativa. */
    async resumePendingOAuthCourse(): Promise<boolean> {
        if (sessionStorage.getItem(OAUTH_PENDING_KEY) !== '1' || !CoreSites.isLoggedIn()) {
            return false;
        }

        sessionStorage.removeItem(OAUTH_PENDING_KEY);
        this.oauthReturnNavigating = false;
        this.oauthCallbackReceived = false;
        await this.afterOAuthLogin();

        return true;
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
     * Marca que o curso foi aberto pelo Painel AVA (não pelo Dashboard Moodle).
     * O observer de NavigationEnd só redireciona quando essas flags existem.
     */
    private markCourseOriginFromPainel(courseId: number): void {
        sessionStorage.setItem(COURSE_ORIGIN_KEY, 'painel');
        sessionStorage.setItem(COURSE_ORIGIN_ID_KEY, String(courseId));
        this.courseOpenedFromPainel = false;
        this.redirectingToPainel = false;
        this.previousCourseNavUrl = normalizeAppPath(CoreNavigator.getCurrentPath() || '');
        // eslint-disable-next-line no-console
        console.log(COURSE_NAV_LOG, 'origin=painel');
        this.ensureCourseNavObserver();
    }

    /** Remove flags de origem Painel↔curso (após redirect ou falha ao abrir). */
    private clearCourseOriginFlags(): void {
        sessionStorage.removeItem(COURSE_ORIGIN_KEY);
        sessionStorage.removeItem(COURSE_ORIGIN_ID_KEY);
        this.courseOpenedFromPainel = false;
    }

    /**
     * Observer único de NavigationEnd.
     * Só redireciona Painel quando: origin=painel + curso já aberto +
     * saída de course/{id} (index/tabs) para landing /main|dashboard.
     * Não intercepta Back global nem rotas filhas (mod/quiz/PDF/fórum…).
     */
    private ensureCourseNavObserver(): void {
        if (this.courseNavObserverRegistered) {
            return;
        }

        this.courseNavObserverRegistered = true;
        this.previousCourseNavUrl = normalizeAppPath(CoreNavigator.getCurrentPath() || '');

        this.router.events.subscribe((event) => {
            if (event instanceof NavigationError && this.courseOpening) {
                logSiteError('NavigationError durante abertura IFRN', event.error, {
                    courseId: this.courseOpening.courseId,
                    path: normalizeAppPath(event.url),
                });
            }

            if (event instanceof NavigationEnd) {
                this.handleCourseNavEnd(event.urlAfterRedirects || event.url);
            }
        });
    }

    /**
     * Reage a cada NavigationEnd. Sem flags → no-op (Dashboard Moodle intacto).
     */
    private handleCourseNavEnd(url: string): void {
        const path = normalizeAppPath(url);
        const previousPath = this.previousCourseNavUrl;

        this.previousCourseNavUrl = path;

        if (this.redirectingToPainel) {
            return;
        }

        const origin = sessionStorage.getItem(COURSE_ORIGIN_KEY);
        const courseIdRaw = sessionStorage.getItem(COURSE_ORIGIN_ID_KEY);

        if (origin === 'painel') {
            // eslint-disable-next-line no-console
            console.log(COURSE_NAV_LOG, 'NavigationEnd', JSON.stringify({
                previousPath,
                path,
                courseId: Number(courseIdRaw),
                courseOpenedFromPainel: this.courseOpenedFromPainel,
                opening: !!this.courseOpening,
                redirectingToPainel: this.redirectingToPainel,
            }));
        }

        if (origin !== 'painel' || !courseIdRaw) {
            this.courseOpenedFromPainel = false;

            return;
        }

        const courseId = Number(courseIdRaw);

        if (!Number.isFinite(courseId) || courseId <= 0) {
            this.clearCourseOriginFlags();

            return;
        }

        // 1) Curso principal (index + tabs) ficou visível → liberar o retorno.
        if (isCourseIndexPath(path, courseId)) {
            this.hideNativeCourseHandoff();
            if (!this.courseOpenedFromPainel) {
                this.courseOpenedFromPainel = true;
                // eslint-disable-next-line no-console
                console.log(COURSE_NAV_LOG, 'course opened');
            }

            return;
        }

        // Ainda não vimos o course index (ex.: /login → /main no deep link).
        if (!this.courseOpenedFromPainel) {
            return;
        }

        // Mesmo após reconhecer o index, não disputar transições de entrada.
        if (this.courseOpening) {
            return;
        }

        // 2) Só redireciona ao sair do index do curso marcado para a landing do Main Menu.
        //    course → mod_*/quiz/PDF/fórum: destino NÃO é landing → ignore.
        if (
            previousPath
            && isCourseIndexPath(previousPath, courseId)
            && isMainMenuLandingPath(path)
        ) {
            // eslint-disable-next-line no-console
            console.log(COURSE_NAV_LOG, 'leaving course to main');
            // eslint-disable-next-line no-console
            console.log(COURSE_NAV_LOG, 'redirecting to painel');

            // Limpa estado ANTES do assign (evita reentrância / segundo redirect).
            this.redirectingToPainel = true;
            this.clearCourseOriginFlags();
            this.redirectToPainelAva();
        } else if (isMainMenuLandingPath(path) || (
            /\/course(?:\/deep)*\/\d+/.test(path)
            && Number(path.match(/\/course(?:\/deep)*\/(\d+)/)?.[1]) !== courseId
        )) {
            // A origem vale apenas para este curso. Após sair para outra área,
            // uma abertura futura pelo Dashboard não deve herdar a flag antiga.
            this.clearCourseOriginFlags();
        }
    }

    /** Mesmo destino do goBack() da ponte moodle-open-course. */
    private redirectToPainelAva(): void {
        const base = document.querySelector('base')?.getAttribute('href') || '/';
        const root = base.endsWith('/') ? base : `${base}/`;

        window.location.assign(`${root}mobilemoodle/index.html#/painel`);
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
        this.lastCourseAccessIssue = null;

        // eslint-disable-next-line no-console
        console.log(COURSE_LOG, 'courseId recebido do Painel =', courseId);

        this.setPendingOpenCourse({ courseId, siteUrl, courseName });

        const identityResult = await this.ensureMatchingMoodleSession(siteUrl);

        // eslint-disable-next-line no-console
        console.log(COURSE_LOG, 'sessão validada', JSON.stringify({ courseId, identityResult }));

        if (identityResult === 'oauth-mismatch') {
            throw new Error(this.lastError);
        }

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
     * Identidade canônica: conta do perfil do Painel antes do login digitado/CPF.
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
     * Compara username Moodle com a conta solicitada pelo perfil do Painel.
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
        const preferred = allowedIdentityCandidates(candidates)[0];

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

        // Uma sessão de outra conta não deve ser reutilizada nem provocar um
        // ciclo de OAuth automático. A tela oferece a troca explícita de conta.
        if (hasSession && match.hasExpected && !match.matches) {
            this.reportCourseAccessIssue('identity-mismatch', this.getPendingOpenCourse()?.courseId || 0);

            return 'oauth-mismatch';
        }

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
        const allowedCandidates = allowedIdentityCandidates(candidates);

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
     * Fora do main menu (ex.: /login/moodle-open-course), o núcleo entra em
     * /main via redirectPath e empilha o curso sobre o Dashboard — por isso
     * marcamos origem=painel e o observer devolve ao Painel no Voltar do index.
     *
     * Dentro do main menu: CoreCourseHelper.getAndOpenCourse (igual “Meus cursos”).
     * Só abre se course.id === courseId em getUserCourses(). Sem aproximação por nome.
     */
    openCourseById(courseId: number): Promise<number> {
        if (this.courseOpening) {
            if (this.courseOpening.courseId === courseId) {
                return this.courseOpening.promise;
            }

            return Promise.reject(new Error('Já existe outro curso Moodle sendo aberto.'));
        }

        const promise = this.performOpenCourseById(courseId).finally(() => {
            this.courseOpening = null;
            this.hideNativeCourseHandoff();
        });
        this.courseOpening = { courseId, promise };

        return promise;
    }

    private async performOpenCourseById(courseId: number): Promise<number> {
        try {
            await useIfrnBrazilianPortuguese();
        } catch (error) {
            // Falha de idioma não deve impedir a abertura do curso.
            this.logger.error('Não foi possível ativar o português brasileiro.', error);
        }

        this.lastError = '';
        this.lastCourseAccessIssue = null;

        const match = this.matchCurrentMoodleIdentity();

        if (!CoreSites.isLoggedIn()) {
            throw new Error('Não há sessão Moodle ativa.');
        }

        if (match.hasExpected && !match.matches) {
            throw new Error(this.reportCourseAccessIssue('identity-mismatch', courseId));
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
            console.error(COURSE_LOG, 'buscar cursos erro', JSON.stringify({
                message: error instanceof Error ? error.message : String(error),
            }));

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
            const message = this.reportCourseAccessIssue('not-enrolled', courseId);

            // eslint-disable-next-line no-console
            console.warn(COURSE_LOG, 'courseId não matriculado — abertura cancelada', JSON.stringify({
                requested: courseId,
                enrolledCount: courses.length,
            }));

            this.lastError = message;
            throw new Error(message);
        }

        const siteId = CoreSites.getCurrentSiteId();

        // Reaproveita a rota, os componentes, handlers e toda a lógica
        // nativa do Moodle Mobile. MoodleIFRN altera apenas a camada visual.
        // eslint-disable-next-line no-console
        console.log(COURSE_LOG, 'abrindo curso nativo Moodle', JSON.stringify({
            courseId,
            siteIdPresent: !!siteId,
            frontend: 'moodle-native+ifrn-theme',
        }));

        // Origem Painel: Voltar na página principal do curso → Painel AVA
        // (não o Dashboard Moodle). Sem flag = comportamento nativo intacto.
        this.markCourseOriginFromPainel(courseId);

        const navigation = this.waitForCourseNavigation(courseId);
        let openingTimeout: number | undefined;
        const openingDeadline = new Promise<never>((_resolve, reject) => {
            openingTimeout = window.setTimeout(() => {
                reject(new Error('A abertura do curso demorou demais. Tente novamente ou volte ao Painel.'));
            }, 45000);
        });

        try {
            // eslint-disable-next-line no-console
            console.log(COURSE_LOG, 'chamando getAndOpenCourse', JSON.stringify({ courseId, siteIdPresent: !!siteId }));
            // O handler nativo não aguarda navigateToSitePath. A Promise do helper
            // pode resolver em /main: também aguardamos NavigationEnd do curso.
            await Promise.race([openingDeadline, Promise.all([
                CoreCourseHelper.getAndOpenCourse(courseId, {}, siteId).then(() => {
                    // eslint-disable-next-line no-console
                    console.log(COURSE_LOG, 'getAndOpenCourse retornou (rota ainda deve ser confirmada)', JSON.stringify({
                        courseId,
                        siteIdPresent: !!siteId,
                    }));
                }),
                navigation.promise,
            ])]);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(COURSE_LOG, 'getAndOpenCourse / navegação FALHOU', JSON.stringify({
                courseId,
                siteIdPresent: !!siteId,
                path: normalizeAppPath(CoreNavigator.getCurrentPath() || ''),
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            }));
            this.clearCourseOriginFlags();
            throw error;
        } finally {
            window.clearTimeout(openingTimeout);
            navigation.dispose();
            this.hideNativeCourseHandoff();
        }

        // eslint-disable-next-line no-console
        console.log(COURSE_LOG, 'curso nativo aberto', JSON.stringify({ courseId }));

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

    /** Aguarda a rota real, sem substituir handlers, componentes ou APIs nativos. */
    private waitForCourseNavigation(courseId: number): { promise: Promise<void>; dispose: () => void } {
        let dispose = (): void => { /* Instalado abaixo antes de retornar. */ };
        const promise = new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
                reject(new Error(`A abertura do curso ${courseId} não confirmou a rota nativa em 45 segundos.`));
            }, 45000);
            const subscription = this.router.events.subscribe((event) => {
                if (event instanceof NavigationEnd && isCourseIndexPath(event.urlAfterRedirects || event.url, courseId)) {
                    resolve();
                } else if (event instanceof NavigationError && (
                    isCourseIndexPath(event.url, courseId) || isMainMenuLandingPath(event.url)
                )) {
                    reject(event.error);
                }
            });

            dispose = () => {
                window.clearTimeout(timeout);
                subscription.unsubscribe();
            };

            // O helper pode somente selecionar a aba de um curso já visível.
            if (isCourseIndexPath(CoreNavigator.getCurrentPath() || '', courseId)) {
                resolve();
            }
        });

        return { promise, dispose: () => dispose() };
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
        this.lastCourseAccessIssue = null;
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
        console.log(SITE_LOG, 'startSuapOAuthLogin', JSON.stringify({
            rawCandidate: rawCandidate || null,
            targetSiteUrl,
            courseId: pending?.courseId ?? null,
        }));

        const siteCheck = await this.checkPresencialSite(targetSiteUrl);

        // eslint-disable-next-line no-console
        console.log(SITE_LOG, 'checkSite OK — próxima etapa: identity providers', JSON.stringify({
            siteUrl: siteCheck.siteUrl,
            typeoflogin: siteCheck.code,
            hasConfig: !!siteCheck.config,
            enablemobilewebservice: siteCheck.config?.enablemobilewebservice,
        }));

        const provider = await this.findSuapProvider(siteCheck);

        // eslint-disable-next-line no-console
        console.log(SITE_LOG, 'findSuapProvider', JSON.stringify({
            found: !!provider,
            name: provider?.name || null,
            url: provider?.url ? sanitizeUrlForLog(provider.url) : null,
        }));

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
                // O deep-link manager trata redirectPath como rota DO SITE.
                // /login/... aqui virava /main/home/login/... (NG04002).
                // Primeiro conclui a landing nativa; nextNavigation usa navigate
                // absoluto para a ponte IFRN, mantendo a sessão recém-criada.
                redirectPath: MAIN_MENU_HOME_PAGE_NAME,
                redirectOptions: {
                    nextNavigation: {
                        path: '/login/moodle-open-course',
                        isSitePath: false,
                        options: {
                            animated: false,
                            params: {
                                courseId: pending.courseId,
                                courseName: pending.courseName,
                            },
                        },
                    },
                },
            }
            : undefined;

        // eslint-disable-next-line no-console
        console.log(SITE_LOG, 'openBrowserForOAuthLogin (fluxo oficial, NÃO InAppBrowser)', JSON.stringify({
            siteUrl: siteCheck.siteUrl,
            oauthsso: oauthParams.id,
            launchurl: siteCheck.config?.launchurl
                ? sanitizeUrlForLog(siteCheck.config.launchurl)
                : null,
            redirectPath: redirectData?.redirectPath || null,
            note: 'Retorno esperado: moodlemobile://token=… → handleOpenURL → newSite',
        }));

        const opened = await CoreLoginHelper.openBrowserForOAuthLogin(
            siteCheck.siteUrl,
            provider,
            siteCheck.config?.launchurl,
            redirectData,
        );

        // eslint-disable-next-line no-console
        console.log(SITE_LOG, 'openBrowserForOAuthLogin resultado', JSON.stringify({
            opened,
            pendingOAuth: sessionStorage.getItem(OAUTH_PENDING_KEY) === '1',
        }));

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
        console.log(SITE_LOG, 'CoreSites.checkSite → getPublicConfig', JSON.stringify({
            requested: siteUrl,
            resolved,
        }));

        try {
            const result = await CoreSites.checkSite(
                resolved,
                'https://',
                'IFRN Moodle',
            );

            // eslint-disable-next-line no-console
            console.log(SITE_LOG, 'CoreSites.checkSite sucesso', JSON.stringify({
                siteUrl: result.siteUrl,
                code: result.code,
            }));

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
            this.reportCourseAccessIssue('identity-mismatch', pending?.courseId || 0);

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
            console.error(COURSE_LOG, 'abrir curso pendente após OAuth falhou', JSON.stringify({
                courseId: pending.courseId,
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            }));
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
