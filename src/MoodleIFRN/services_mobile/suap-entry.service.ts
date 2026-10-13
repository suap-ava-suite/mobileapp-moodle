import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CoreEvents } from '@static/events';
import { CoreSites } from '@services/sites';
import { CoreSitesFactory } from '@services/sites-factory';
import { CoreLoginHelper } from '@features/login/services/login-helper';
import { MAIN_MENU_HOME_PAGE_NAME } from '@features/mainmenu/constants';
import { AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { BiometricService } from '@/MoodleIFRN/services_mobile/biometric.service';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { SuapBrowserService } from './suap-browser.service';
import { CoreOpener } from '@static/opener';
import { OAUTH_PROFILE_KEY, profileIdentity } from '../mobilemoodle/core_mobile/oauth-profile';
import { beginNativeSuapEntry, readNativeSuapEntry, endNativeSuapEntry, markNativeSuapEntryAuthenticated } from '../navigation/suap-entry-state';

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
type Profile = Record<string, unknown>;
const present = (value: unknown): boolean => value !== undefined && value !== null && String(value).trim() !== '';
const PHOTO_KEYS = ['url_foto_150x200', 'url_foto_75x100', 'foto'] as const;

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
    private staged?: { profile: Profile; dashboard: unknown; until: number; siteId: string };

    constructor() {
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
        onStatus('Abrindo a autenticação oficial do SUAP…');
        try {
            onStatus('Consultando o AVA…');
            const check = await this.suapBrowser.waitFor(CoreSites.checkSite(AVA), 30000,
                'O AVA não respondeu à consulta inicial. Verifique sua conexão e tente novamente.');
            if (!check.config || new URL(check.siteUrl).origin !== AVA) {
                throw new Error('O AVA não retornou uma configuração mobile válida.');
            }
            const site = CoreSitesFactory.makeUnauthenticatedSite(check.siteUrl, check.config);
            onStatus('Preparando o acesso SUAP…');
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
        if (!value || value.until <= Date.now() || !site || site.isLoggedOut() || site.getId() !== value.siteId
            || String(site.getInfo()?.username || '').trim() !== profileIdentity(value.profile)) {
            this.cancel();
            throw new Error('A sessão de entrada expirou. Inicie a entrada novamente.');
        }
        const keys = ['ifrn_username', 'ifrn_access_token', 'ifrn_refresh_token', 'ifrn_biometric_login_enabled',
            'ifrn_painel_profile', 'ifrn_painel_dashboard', 'ifrn_painel_owner', 'ifrn_painel_token', OAUTH_PROFILE_KEY];
        const backup = [sessionStorage, localStorage].map(storage => ({
            storage, values: keys.map(key => ({ key, value: storage.getItem(key) })),
        }));
        try {
            this.authService.saveOAuthSession(value.profile, 1800);
            sessionStorage.setItem('ifrn_painel_dashboard', JSON.stringify(value.dashboard));
            sessionStorage.setItem('ifrn_painel_owner', profileIdentity(value.profile).toLowerCase());
            sessionStorage.removeItem('ifrn_painel_token');
            localStorage.removeItem('ifrn_painel_token');
            this.biometricService.disable();
            this.authService.openMobileMoodle('/painel');
            this.cancel();
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
        this.staged = undefined;
        endNativeSuapEntry();
    }
}
