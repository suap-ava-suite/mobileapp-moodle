import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CoreEvents } from '@static/events';
import { CoreConstants } from '@/core/constants';
import { CoreAlerts } from '@services/overlays/alerts';
import { CoreSites } from '@services/sites';
import { CoreSitesFactory } from '@services/sites-factory';
import { CoreLoginHelper } from '@features/login/services/login-helper';
import { MAIN_MENU_HOME_PAGE_NAME } from '@features/mainmenu/constants';
import { AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { BiometricService } from '@/MoodleIFRN/services_mobile/biometric.service';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { SuapBrowserService } from './suap-browser.service';
import { CoreOpener } from '@static/opener';
import { OAUTH_PROFILE_KEY, OAUTH_PROFILE_MAX_AGE_SECONDS, profileIdentity } from '../mobilemoodle/core_mobile/oauth-profile';
import { beginNativeSuapEntry, readNativeSuapEntry, endNativeSuapEntry, markNativeSuapEntryAuthenticated } from '../navigation/suap-entry-state';
import { clearFreshPanelProfile, FRESH_PROFILE_SKIP_KEY, markFreshPanelProfile, reportSuapDuration }
    from './suap-login-telemetry';
import { PAINEL_AVA_CONFIG } from './painel-ava.config';

/** Divergência comprovada: transporta as contas para a tela de recuperação. */
export class SuapEntryAccountError extends Error {
    constructor(
        public readonly expectedLogin: string,
        public readonly actualLogin: string,
        public readonly source: 'moodle' | 'painel',
    ) {
        super('As contas do AVA e do Painel são diferentes. Entre com a mesma matrícula para continuar.');
        this.name = 'SuapEntryAccountError';
    }
}

const AVA = 'https://academico.ava.ifrn.edu.br';
const MOBILE_SUAP_PENDING_KEY = 'ifrn_mobile_suap_pkce_pending_v1';
const MOBILE_CALLBACK_HOST = 'ifrn-auth';
const MOBILE_CALLBACK_PATH = '/callback';
type Profile = Record<string, unknown>;
type LaunchMyAppPlugin = { getLastIntent?: (success: (url: string) => void) => void };
const present = (value: unknown): boolean => value !== undefined && value !== null && String(value).trim() !== '';
const PHOTO_KEYS = ['url_foto_150x200', 'url_foto_75x100', 'foto'] as const;

function base64Url(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function createMobilePkce(): Promise<{ state: string; verifier: string; challenge: string }> {
    if (!window.crypto?.subtle || !window.crypto?.getRandomValues) {
        throw new Error('Este dispositivo não oferece suporte seguro ao retorno de autenticação.');
    }
    const stateBytes = window.crypto.getRandomValues(new Uint8Array(32));
    const verifierBytes = window.crypto.getRandomValues(new Uint8Array(32));
    const state = base64Url(stateBytes);
    const verifier = base64Url(verifierBytes);
    const hash = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));

    return { state, verifier, challenge: base64Url(new Uint8Array(hash)) };
}

function isMobileAuthCallback(rawUrl: string): boolean {
    try {
        const url = new URL(rawUrl);
        return url.protocol === `${CoreConstants.CONFIG.customurlscheme}:`
            && url.hostname === MOBILE_CALLBACK_HOST && url.pathname === MOBILE_CALLBACK_PATH;
    } catch {
        return false;
    }
}

/** Avatar genérico do Moodle — não deve impedir foto oficial do painel/SUAP. */
export function isPlaceholderPhoto(url: unknown): boolean {
    if (typeof url !== 'string' || !url.trim()) {
        return true;
    }
    return /defaultuserpic|gravatar\.com\/avatar\/|\/u\/f\d+|theme\/.*?\/pix_core\/u\//i.test(url);
}

function panelIdentity(profile: Profile | null | undefined): string {
    if (!profile) {
        return '';
    }
    for (const key of ['matricula', 'identificacao', 'username']) {
        const value = profile[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

function usablePhoto(value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }
    const trimmed = value.trim();
    if (!trimmed || isPlaceholderPhoto(trimmed)) {
        return '';
    }
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
        return trimmed;
    }
    if (trimmed.startsWith('/media/') || trimmed.startsWith('/static/')) {
        return `https://suap.ifrn.edu.br${trimmed}`;
    }
    if (trimmed.startsWith('/')) {
        return `https://ava.ifrn.edu.br${trimmed}`;
    }
    return '';
}

/** Mapeamento explícito, sem inventar e-mail preferencial nem copiar dados de outra conta. */
export function mapNativeProfile(
    profile: Profile,
    username: string,
    previous: Profile = {},
    photoUrl?: string,
): Profile {
    const fields = new Map<string, unknown>();
    for (const field of Array.isArray(profile.customfields) ? profile.customfields as Profile[] : []) {
        if (typeof field.shortname === 'string') {
            fields.set(field.shortname, field.value);
        }
    }
    const sameAccount = profileIdentity(previous) === username;
    const result: Profile = sameAccount ? { ...previous } : {};
    const moodlePhoto = present(photoUrl) ? String(photoUrl).trim() : String(profile.profileimageurl || '').trim();
    const moodlePhotoUsable = usablePhoto(moodlePhoto);

    // Campos vazios ou foto Moodle real não podem ficar sombreados por url_foto_* antiga.
    for (const key of PHOTO_KEYS) {
        const previousPhoto = result[key];
        if (typeof previousPhoto === 'string' && !previousPhoto.trim()) {
            delete result[key];
        } else if (moodlePhotoUsable && (key === 'url_foto_150x200' || key === 'url_foto_75x100')) {
            delete result[key];
        }
    }

    const values: Profile = {
        identificacao: username, nome: profile.fullname, nome_usual: fields.get('nome_apresentacao') || profile.fullname,
        nome_registro: fields.get('nome_completo'), nome_social: fields.get('nome_social'),
        primeiro_nome: profile.firstname, ultimo_nome: profile.lastname,
        foto: moodlePhotoUsable || moodlePhoto || undefined, email: profile.email,
        email_secundario: fields.get('email_secundario'), email_academico: fields.get('email_academico'),
        email_google_classroom: fields.get('email_google_classroom'), email_preferencial: fields.get('email_preferencial'),
        campus: present(fields.get('campus_sigla')) && result.campus && typeof result.campus === 'object'
            ? { ...result.campus as Profile, sigla: fields.get('campus_sigla') } : fields.get('campus_sigla'),
        tipo_usuario: fields.get('tipo_usuario'),
        cpf: fields.get('cpf'), data_de_nascimento: fields.get('data_de_nascimento'), sexo: fields.get('sexo'),
    };
    for (const [key, value] of Object.entries(values)) {
        if (present(value)) {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Enriquecimento somente após matrícula do painel == username Moodle.
 * Usa foto oficial do painel/SUAP quando a do Moodle é placeholder ou ausente.
 */
export function mergeVerifiedPanelProfile(
    moodleProfile: Profile,
    panelProfile: Profile | null | undefined,
    identity: string,
): Profile {
    const owner = panelIdentity(panelProfile);
    if (!panelProfile || !owner || owner !== identity) {
        return moodleProfile;
    }
    const result: Profile = { ...moodleProfile, matricula: identity, identificacao: identity };
    const moodleHasPhoto = !!usablePhoto(result['foto']);
    for (const key of PHOTO_KEYS) {
        const panelPhoto = usablePhoto(panelProfile[key]);
        if (panelPhoto && (!moodleHasPhoto || !usablePhoto(result[key]))) {
            result[key] = panelPhoto;
        }
    }
    if (!usablePhoto(result['foto'])) {
        const fallback = usablePhoto(panelProfile['url_foto_150x200'])
            || usablePhoto(panelProfile['url_foto_75x100'])
            || usablePhoto(panelProfile['foto']);
        if (fallback) {
            result['foto'] = fallback;
        }
    }
    for (const key of ['nome_usual', 'nome_social', 'nome_registro'] as const) {
        if (!present(result[key]) && present(panelProfile[key])) {
            result[key] = panelProfile[key];
        }
    }
    return result;
}

@Injectable({ providedIn: 'root' })
export class SuapEntryService {
    private readonly authService = inject(AuthService);
    private readonly biometricService = inject(BiometricService);
    private readonly painel = inject(PainelAvaService);
    private readonly suapBrowser = inject(SuapBrowserService);
    private loading = false;
    private staged?: { profile: Profile; dashboard: unknown; until: number; siteId?: string };
    private mobileCallbackProcessing = false;
    private mobileLoginTimer?: ReturnType<typeof setTimeout>;

    /** A entrada do painel usa o OAuth SUAP sem exigir conta no Moodle Acadêmico. */
    async loginWithSuap(
        expectedIdentity = '',
        onStatus: (message: string) => void = () => {},
    ): Promise<void> {
        if (this.loading) {
            return;
        }
        const loginStartedAt = performance.now();
        this.loading = true;
        this.cancel();
        onStatus('Acessando o SUAP…');
        try {
            const pkce = await createMobilePkce();
            const pending = { ...pkce, expectedIdentity: expectedIdentity.trim(), startedAt: Date.now() };
            const capabilityHeaders = new Headers();
            capabilityHeaders.set('Accept', 'application/json');
            let capability: Response;
            try {
                capability = await fetch(new URL('/auth/mobile/capability/', PAINEL_AVA_CONFIG.baseUrl), {
                    method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
                    headers: capabilityHeaders,
                });
            } catch {
                await this.loginWithLegacySuap(expectedIdentity, onStatus);
                return;
            }
            if (!capability.ok) {
                await this.loginWithLegacySuap(expectedIdentity, onStatus);
                return;
            }
            sessionStorage.setItem(MOBILE_SUAP_PENDING_KEY, JSON.stringify(pending));
            beginNativeSuapEntry(expectedIdentity.trim());
            const startUrl = new URL('/auth/mobile/start/', PAINEL_AVA_CONFIG.baseUrl);
            startUrl.searchParams.set('state', pkce.state);
            startUrl.searchParams.set('code_challenge', pkce.challenge);
            startUrl.searchParams.set('code_challenge_method', 'S256');

            // Use o navegador do sistema; Gov.br não será aberto em WebView.
            const opened = window.open(startUrl.toString(), '_system');
            if (!opened) {
                sessionStorage.removeItem(MOBILE_SUAP_PENDING_KEY);
                endNativeSuapEntry();
                throw new Error('Não foi possível abrir o navegador seguro para o SUAP.');
            }
            this.mobileLoginTimer = setTimeout(() => this.failMobileLogin(
                'A tentativa de login expirou ou foi cancelada. Toque em Entrar no AVA para tentar novamente.',
            ), 300000);
            reportSuapDuration('suap-browser-open-requested', performance.now() - loginStartedAt);
        } finally {
            this.loading = false;
            onStatus('');
        }
    }

    private async loginWithLegacySuap(
        expectedIdentity: string,
        onStatus: (message: string) => void,
    ): Promise<void> {
        onStatus('Carregando cursos e confirmando seu perfil…');
        const panel = await firstValueFrom(this.painel.authenticateWithBrowser({ readOnly: true, reuseSession: false }));
        const identity = panelIdentity(panel.diagnosticProfile);
        const dashboard = panel.diagnosticDashboard;
        if (!identity || !panel.diagnosticProfile || panel.diagnosticOwner !== identity) {
            throw new Error('Não foi possível confirmar a identidade da sessão SUAP. Tente novamente.');
        }
        if (expectedIdentity && identity !== expectedIdentity.trim()) {
            throw new SuapEntryAccountError(expectedIdentity.trim(), identity, 'painel');
        }
        if (!dashboard || typeof dashboard !== 'object' || Array.isArray(dashboard)
            || !Array.isArray((dashboard as Profile).diarios)) {
            throw new Error('O Painel não retornou uma lista de disciplinas válida. Tente novamente.');
        }

        this.staged = { profile: { ...panel.diagnosticProfile, identificacao: identity }, dashboard, until: Date.now() + 180000 };
        this.commit();
        onStatus('');
    }

    constructor() {
        CoreEvents.on(CoreEvents.APP_LAUNCHED_URL, data => {
            const url = data?.url || '';
            if (isMobileAuthCallback(url)) {
                void this.completeMobileAuthCallback(url);
            }
        });
        document.addEventListener('resume', () => this.handleMobileAuthResume());
        // A Activity pode ter recebido o deep link antes da inicialização do serviço.
        // O plugin mantém a URL de lançamento sem expor código em logs.
        setTimeout(() => this.consumeLastMobileIntent(), 0);

        // Registrar antes de iniciar o OAuth, inclusive se a shell de cursos ainda
        // não foi inicializada. O evento vem após o núcleo aceitar o token SSO.
        CoreEvents.on(CoreEvents.LOGIN, () => {
            const site = CoreSites.getCurrentSite();
            if (site && CoreSites.isLoggedIn() && !site.isLoggedOut()
                && new URL(site.getURL()).origin === AVA) {
                markNativeSuapEntryAuthenticated(site.getId());
            }
        });
    }

    /** O núcleo Moodle controla o OAuth e valida seu retorno; nenhum broker local é usado. */
    async login(expectedIdentity = '', onStatus: (message: string) => void = () => {}): Promise<boolean> {
        if (this.loading) {
            return false;
        }
        this.loading = true;
        this.cancel();
        onStatus('Acessando o SUAP…');
        try {
            const check = await this.suapBrowser.waitFor(CoreSites.checkSite(AVA), 30000,
                'O AVA não respondeu à consulta inicial. Verifique sua conexão e tente novamente.');
            if (!check.config || new URL(check.siteUrl).origin !== AVA) {
                throw new Error('O AVA não retornou uma configuração mobile válida.');
            }
            const site = CoreSitesFactory.makeUnauthenticatedSite(check.siteUrl, check.config);
            const providers = await this.suapBrowser.waitFor(
                CoreLoginHelper.getValidIdentityProvidersForSite(site), 30000,
                'O AVA não retornou a configuração do login SUAP. Tente novamente.');
            const provider = providers.find(item => item.name.trim().toLowerCase() === 'suap');
            if (!provider) {
                throw new Error('O AVA não informou o provedor SUAP. Tente novamente mais tarde.');
            }
            beginNativeSuapEntry(expectedIdentity.trim());
            const opened = await this.suapBrowser.login(check.siteUrl, provider, check.config.launchurl, {
                redirectPath: MAIN_MENU_HOME_PAGE_NAME,
                redirectOptions: { nextNavigation: {
                    path: '/login/marketplace-ifrn', isSitePath: false,
                    options: { animated: false, params: { nativeSuapReturn: true } },
                } },
            });
            if (!opened) {
                throw new Error('Não foi possível abrir o login do AVA. Verifique sua conexão e tente novamente.');
            }
            return false; // O retorno OAuth chega em outra navegação; ainda não abre o painel.
        } catch (error) {
            endNativeSuapEntry();
            throw error;
        } finally {
            this.loading = false;
            onStatus('');
        }
    }

    async complete(onStatus: (message: string) => void = () => {}): Promise<void> {
        if (this.loading) {
            return;
        }
        const entry = readNativeSuapEntry();
        if (!entry) {
            throw new Error('A tentativa de entrada expirou. Toque em Entrar no AVA novamente.');
        }
        clearFreshPanelProfile();
        this.loading = true;
        endNativeSuapEntry(); // Consome uma única vez, evitando ciclos e callbacks duplicados.
        try {
            const site = CoreSites.getCurrentSite();
            if (!site || site.isLoggedOut() || !CoreSites.isLoggedIn() || new URL(site.getURL()).origin !== AVA
                || (entry.authenticatedSiteId && entry.authenticatedSiteId !== site.getId())) {
                throw new Error('A autenticação do AVA não foi concluída. Tente novamente.');
            }
            // Um callback aceito com o mesmo token não dispara LOGIN no núcleo.
            // A leitura sem cache abaixo verifica a sessão real, também nesse caso.
            onStatus('Carregando seu perfil…');
            const info = site.getInfo();
            if (!info?.userid) {
                throw new Error('O AVA não informou o usuário autenticado.');
            }
            const profiles = await site.read<Profile[]>('core_user_get_users_by_field', {
                field: 'id', values: [String(info.userid)],
            }, { getFromCache: false, saveToCache: false });
            const raw = profiles.find(item => Number(item.id) === info.userid);
            const identity = String(raw?.username || info.username || '').trim();
            if (!raw || !identity) {
                throw new Error('A conta do AVA não corresponde à matrícula esperada. Entre com a conta correta.');
            }
            if (entry.expectedIdentity && identity !== entry.expectedIdentity) {
                throw new SuapEntryAccountError(entry.expectedIdentity, identity, 'moodle');
            }
            let previous: Profile = {};
            try {
                previous = JSON.parse(sessionStorage.getItem('ifrn_painel_profile') || '{}') || {};
            } catch {
                // Perfil anterior inválido não participa da nova sessão.
            }
            const rawPhoto = String(raw.profileimageurl || '').trim();
            let photoUrl = rawPhoto;
            try {
                if (rawPhoto) {
                    photoUrl = site.fixPluginfileURL(rawPhoto) || rawPhoto;
                }
            } catch {
                // Mantém a URL original se o núcleo não puder tokenizar o pluginfile.
            }
            const profile = mapNativeProfile(raw, identity, previous, photoUrl);
            onStatus('Conectando ao Painel AVA…');
            const previousIdentity = sessionStorage.getItem('ifrn_username') || '';
            const panel = await firstValueFrom(this.painel.authenticateWithBrowser({
                readOnly: true, reuseSession: previousIdentity === identity && !entry.expectedIdentity,
            }));
            onStatus('Organizando seus cursos…');
            const dashboard = panel.diagnosticDashboard;
            if (!dashboard || typeof dashboard !== 'object' || Array.isArray(dashboard)
                || !Array.isArray((dashboard as Profile).diarios)) {
                throw new Error('O painel não retornou uma lista de cursos válida. Seus dados anteriores foram mantidos.');
            }
            const owner = String(panel.diagnosticOwner || panelIdentity(panel.diagnosticProfile) || '').trim();
            const identidadeDisponivel = !!owner;
            const contaCorresponde = identidadeDisponivel && owner === identity;
            // eslint-disable-next-line no-console
            console.log('[IFRN-ENTRY]', JSON.stringify({ identidadeDisponivel, contaCorresponde }));
            if (identidadeDisponivel && !contaCorresponde) {
                throw new SuapEntryAccountError(identity, owner, 'painel');
            }
            if (!identidadeDisponivel) {
                throw new Error(
                    'Não foi possível confirmar a matrícula da sessão do painel. '
                    + 'Saia dessa conta no navegador interno e entre com a mesma matrícula do AVA. '
                    + 'Seus dados anteriores foram mantidos.',
                );
            }
            this.staged = {
                profile: mergeVerifiedPanelProfile(profile, panel.diagnosticProfile, identity),
                dashboard,
                until: Date.now() + 180000,
                siteId: site.getId(),
            };
            this.commit();
        } finally {
            this.loading = false;
            onStatus('');
        }
    }

    /** Persiste somente após matrícula do painel coincidir com o username Moodle. */
    private commit(): void {
        const value = this.staged;
        const site = CoreSites.getCurrentSite();
        if (!value || value.until <= Date.now() || (value.siteId && (!site || site.isLoggedOut()
            || site.getId() !== value.siteId
            || String(site.getInfo()?.username || '').trim() !== profileIdentity(value.profile)))) {
            this.cancel();
            throw new Error('A sessão de entrada expirou. Inicie a entrada novamente.');
        }
        const keys = ['ifrn_username', 'ifrn_access_token', 'ifrn_refresh_token', 'ifrn_biometric_login_enabled',
            'ifrn_painel_profile', 'ifrn_painel_dashboard', 'ifrn_painel_owner', 'ifrn_painel_token', OAUTH_PROFILE_KEY,
            FRESH_PROFILE_SKIP_KEY];
        const backup = [sessionStorage, localStorage].map(storage => ({
            storage, values: keys.map(key => ({ key, value: storage.getItem(key) })),
        }));
        try {
            this.authService.saveOAuthSession(value.profile, OAUTH_PROFILE_MAX_AGE_SECONDS);
            const serializedDashboard = JSON.stringify(value.dashboard);
            const ownerKey = profileIdentity(value.profile).toLowerCase();
            sessionStorage.setItem('ifrn_painel_dashboard', serializedDashboard);
            localStorage.setItem('ifrn_painel_dashboard', serializedDashboard);
            sessionStorage.setItem('ifrn_painel_owner', ownerKey);
            localStorage.setItem('ifrn_painel_owner', ownerKey);
            sessionStorage.removeItem('ifrn_painel_token');
            localStorage.removeItem('ifrn_painel_token');
            this.biometricService.disable();
            this.cancel();
            // Vincula a dispensa ao proprietário validado no mesmo resultado do login.
            markFreshPanelProfile(ownerKey);
            this.authService.openMobileMoodle('/painel');
        } catch (error) {
            for (const { storage, values } of backup) {
                for (const { key, value: old } of values) {
                    if (old === null) {
                        storage.removeItem(key);
                    } else {
                        storage.setItem(key, old);
                    }
                }
            }
            throw error;
        }
    }

    cancelConnection(): void {
        this.suapBrowser.cancel();
        // Se a entrada já avançou à consulta do painel, seu Observable recebe exit.
        if (this.loading) {
            CoreOpener.closeInAppBrowser();
        }
    }

    cancel(): void {
        clearFreshPanelProfile();
        if (this.mobileLoginTimer) {
            clearTimeout(this.mobileLoginTimer);
            this.mobileLoginTimer = undefined;
        }
        this.mobileCallbackProcessing = false;
        this.staged = undefined;
        endNativeSuapEntry();
    }

    private consumeLastMobileIntent(): void {
        const plugins = (window as unknown as { plugins?: { launchmyapp?: LaunchMyAppPlugin } }).plugins;
        const plugin = plugins?.launchmyapp;
        if (typeof plugin?.getLastIntent !== 'function') {
            return;
        }
        plugin.getLastIntent(url => {
            if (isMobileAuthCallback(url)) {
                void this.completeMobileAuthCallback(url);
            }
        });
    }

    private handleMobileAuthResume(): void {
        if (!sessionStorage.getItem(MOBILE_SUAP_PENDING_KEY)) {
            return;
        }

        // Give handleOpenURL/APP_LAUNCHED_URL time to deliver a successful callback first.
        setTimeout(() => {
            if (sessionStorage.getItem(MOBILE_SUAP_PENDING_KEY) && !this.mobileCallbackProcessing) {
                this.failMobileLogin('Login cancelado ou interrompido. Toque em Entrar no AVA para tentar novamente.');
            }
        }, 1500);
    }

    private async completeMobileAuthCallback(rawUrl: string): Promise<void> {
        if (this.mobileCallbackProcessing) {
            return;
        }
        this.mobileCallbackProcessing = true;
        const callbackStartedAt = performance.now();
        try {
            const callback = new URL(rawUrl);
            const code = callback.searchParams.get('code') || '';
            const state = callback.searchParams.get('state') || '';
            const pending = JSON.parse(sessionStorage.getItem(MOBILE_SUAP_PENDING_KEY) || 'null') as {
                state?: string; verifier?: string; expectedIdentity?: string; startedAt?: number;
            } | null;
            if (!pending || !code || !state || state !== pending.state
                || typeof pending.verifier !== 'string' || Date.now() - Number(pending.startedAt) > 300000) {
                throw new Error('O retorno do SUAP não corresponde à tentativa atual. Inicie o login novamente.');
            }

            const exchangeHeaders = new Headers();
            exchangeHeaders.set('Content-Type', 'application/json');
            exchangeHeaders.set('Accept', 'application/json');
            const exchange = await fetch(new URL('/api/v2/mobile-auth/exchange/', PAINEL_AVA_CONFIG.baseUrl), {
                method: 'POST',
                credentials: 'omit',
                cache: 'no-store',
                redirect: 'error',
                headers: exchangeHeaders,
                body: JSON.stringify({ code, state, verifier: pending.verifier }),
            });
            if (!exchange.ok) {
                throw new Error('O código de retorno expirou ou já foi utilizado. Entre no AVA novamente.');
            }
            const tokens = await exchange.json() as { username?: string; access?: string };
            if (!tokens.username || !tokens.access) {
                throw new Error('O servidor não confirmou a identidade autenticada pelo SUAP.');
            }
            if (pending.expectedIdentity && tokens.username !== pending.expectedIdentity) {
                throw new SuapEntryAccountError(pending.expectedIdentity, tokens.username, 'painel');
            }

            const bootstrapHeaders = new Headers();
            bootstrapHeaders.set('Authorization', `Bearer ${tokens.access}`);
            bootstrapHeaders.set('Accept', 'application/json');
            const bootstrapResponse = await fetch(new URL('/api/v2/mobile-auth/bootstrap/', PAINEL_AVA_CONFIG.baseUrl), {
                method: 'GET',
                credentials: 'omit',
                cache: 'no-store',
                redirect: 'error',
                headers: bootstrapHeaders,
            });
            if (!bootstrapResponse.ok) {
                if (bootstrapResponse.status === 409) {
                    throw new Error(
                        'O SUAP autenticou a conta, mas esse vínculo ainda não está sincronizado ou não tem acesso ao Painel AVA.',
                    );
                }
                if (bootstrapResponse.status === 404) {
                    throw new Error('A conta autenticada pelo SUAP ainda não foi provisionada no Painel AVA.');
                }
                throw new Error('O Painel não conseguiu carregar o perfil e as disciplinas desta conta. Tente novamente.');
            }
            const bootstrap = await bootstrapResponse.json() as {
                username?: string; profile?: Profile; dashboard?: Profile;
            };
            const identity = panelIdentity(bootstrap.profile);
            if (!identity || identity !== tokens.username || bootstrap.username !== identity) {
                throw new Error('A identidade do Painel não corresponde ao vínculo escolhido no SUAP.');
            }
            if (!bootstrap.dashboard || !Array.isArray(bootstrap.dashboard.diarios)) {
                throw new Error('O Painel não retornou uma lista de disciplinas válida.');
            }

            this.staged = {
                profile: { ...bootstrap.profile, identificacao: identity },
                dashboard: bootstrap.dashboard,
                until: Date.now() + 180000,
            };
            sessionStorage.removeItem(MOBILE_SUAP_PENDING_KEY);
            if (this.mobileLoginTimer) {
                clearTimeout(this.mobileLoginTimer);
                this.mobileLoginTimer = undefined;
            }
            reportSuapDuration('suap-callback-to-profile-and-courses', performance.now() - callbackStartedAt);
            this.commit();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Não foi possível concluir a autenticação SUAP.';
            this.failMobileLogin(message);
            void CoreAlerts.showError(message);
        } finally {
            this.mobileCallbackProcessing = false;
        }
    }

    private failMobileLogin(message: string): void {
        sessionStorage.removeItem(MOBILE_SUAP_PENDING_KEY);
        if (this.mobileLoginTimer) {
            clearTimeout(this.mobileLoginTimer);
            this.mobileLoginTimer = undefined;
        }
        this.mobileCallbackProcessing = false;
        endNativeSuapEntry();
        sessionStorage.setItem('ifrn_mobile_suap_error_v1', message);
        CoreEvents.trigger('IFRN_SUAP_MOBILE_AUTH_FAILED', { message });
    }

}
