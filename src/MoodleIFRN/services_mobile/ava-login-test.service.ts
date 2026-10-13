import { Injectable } from '@angular/core';
import { CoreSites } from '@services/sites';
import { CoreSitesFactory } from '@services/sites-factory';
import { CoreLoginHelper } from '@features/login/services/login-helper';
import { MAIN_MENU_HOME_PAGE_NAME } from '@features/mainmenu/constants';
import { beginAvaTest, endAvaTest } from '../navigation/ava-test-state';

const AVA = 'https://academico.ava.ifrn.edu.br';

type Profile = Record<string, unknown>;

/** Diagnóstico somente de leitura: não substitui o perfil nem os cursos do painel. */
@Injectable({ providedIn: 'root' })
export class AvaLoginTestService {
    async start(expectedIdentity = ''): Promise<void> {
        sessionStorage.setItem('ifrn_ava_test_expected', expectedIdentity.trim());
        const check = await CoreSites.checkSite(AVA);
        if (!check.config) {
            throw new Error('O AVA não retornou a configuração mobile.');
        }
        const temporary = CoreSitesFactory.makeUnauthenticatedSite(check.siteUrl, check.config);
        const providers = await CoreLoginHelper.getValidIdentityProvidersForSite(temporary);
        const provider = providers.find(item => item.name.trim().toLowerCase() === 'suap');
        if (!provider) {
            throw new Error('O AVA não informou um provedor SUAP para o aplicativo.');
        }
        beginAvaTest();
        let opened = false;
        try {
            opened = await CoreLoginHelper.openBrowserForOAuthLogin(
            check.siteUrl, provider, check.config?.launchurl,
            {
                redirectPath: MAIN_MENU_HOME_PAGE_NAME,
                redirectOptions: {
                    nextNavigation: {
                        path: '/login/ifrn-login',
                        isSitePath: false,
                        options: { animated: false, params: { avaLoginTest: true } },
                    },
                },
            },
            );
        } catch (error) {
            endAvaTest();
            throw error;
        }
        if (!opened) {
            endAvaTest();
            throw new Error('Não foi possível abrir o login nativo do AVA.');
        }
    }

    async inspect(expectedIdentity = sessionStorage.getItem('ifrn_ava_test_expected') || ''): Promise<string> {
        endAvaTest();
        const site = CoreSites.getCurrentSite();
        if (!site || site.isLoggedOut() || !CoreSites.isLoggedIn()
            || new URL(site.getURL()).origin !== AVA) {
            throw new Error('Entre pelo teste do AVA Acadêmico antes de consultar os dados.');
        }
        const info = site.getInfo();
        if (!info?.userid) {
            throw new Error('A sessão Moodle ainda não informou o usuário.');
        }
        const profiles = await site.read<Profile[]>('core_user_get_users_by_field', {
            field: 'id', values: [String(info.userid)],
        }, { getFromCache: false, saveToCache: false });
        const profile = profiles.find(item => Number(item.id) === info.userid);
        if (!profile) {
            throw new Error('O Moodle não retornou o perfil do usuário autenticado.');
        }
        const fields = new Map<string, unknown>();
        const custom = Array.isArray(profile.customfields) ? profile.customfields as Profile[] : [];
        for (const field of custom) {
            if (typeof field.shortname === 'string') {
                fields.set(field.shortname, field.value);
            }
        }
        let baseline: Profile = {};
        try {
            baseline = JSON.parse(sessionStorage.getItem('ifrn_painel_profile') || '{}') || {};
        } catch {
            // Sem referência local, informar somente a presença dos dados.
        }
        const present = (value: unknown): boolean => value !== undefined && value !== null && String(value).trim() !== '';
        const mappings: Array<[string, unknown]> = [
            ['identificacao', profile.username ?? info.username],
            ['nome', profile.fullname],
            ['foto', profile.profileimageurl],
            ['email', profile.email],
            ['email_secundario', fields.get('email_secundario')],
            ['email_academico', fields.get('email_academico')],
            ['email_google_classroom', fields.get('email_google_classroom')],
            ['email_preferencial', fields.get('email_preferencial')],
            ['campus', fields.get('campus_sigla')],
            ['tipo_usuario', fields.get('tipo_usuario')],
            ['cpf', fields.get('cpf')],
            ['data_de_nascimento', fields.get('data_de_nascimento')],
            ['sexo', fields.get('sexo')],
        ];
        const identity = String(profile.username ?? info.username ?? '');
        const expected = expectedIdentity.trim() || String(baseline.identificacao ?? sessionStorage.getItem('ifrn_username') ?? '');
        const sameAccount = expected ? identity === expected : null;
        const results = mappings.map(([field, value]) => ({
            field, available: present(value), availableInPanel: present(baseline[field]),
            matchesPanel: !present(baseline[field]) || !present(value) ? null
                : typeof baseline[field] === 'object' ? null : String(baseline[field]) === String(value),
        }));
        const report = { diagnosticVersion: 2, sameAccount, comparisonSource: expectedIdentity.trim() ? 'manual' : 'panel',
            usernameIsSuapIdentityCandidate: true, customFieldCount: custom.length, fields: results };
        // Somente nomes de campos e indicadores; nunca valores pessoais ou tokens.
        console.log('[IFRN-AVA-TEST]', JSON.stringify(report));
        return [
            sameAccount === true ? 'Conta: corresponde à matrícula de referência.'
                : sameAccount === false ? 'Conta: diferente da matrícula de referência. Não substituir o perfil.' : 'Conta: sem referência para comparar.',
            ...results.map(item => `${item.field}: ${item.available ? 'disponível' : 'ausente/vazio'}`),
            'Identificação usa o username Moodle: confirmar equivalência com a matrícula.',
            'Perfil e cursos do painel não foram substituídos. Este teste não valida todos os ambientes.',
        ].join('\n');
    }

    async inspectCourses(raw: unknown, observedOwner = ''): Promise<string> {
        const site = CoreSites.getCurrentSite();
        if (!site || site.isLoggedOut() || new URL(site.getURL()).origin !== AVA) {
            throw new Error('Sessão do AVA Acadêmico indisponível.');
        }
        const userid = site.getInfo()?.userid;
        if (!userid) {
            throw new Error('Usuário Moodle indisponível.');
        }
        const enrolled = await site.read<Array<{ id: number }>>('core_enrol_get_users_courses', { userid },
            { getFromCache: false, saveToCache: false });
        const root = raw && typeof raw === 'object' ? raw as Profile : {};
        const lists = ['diarios', 'coordenacoes', 'autoinscricoes', 'praticas'];
        const counts = lists.map(list => ({ list, count: Array.isArray(root[list]) ? root[list].length : null }));
        const environments = new Map<string, number>();
        for (const list of lists) {
            for (const item of Array.isArray(root[list]) ? root[list] as unknown[] : []) {
                let environment = 'sem endereço de ambiente';
                if (item && typeof item === 'object') {
                    const entry = item as Profile;
                    try {
                        const hostname = new URL(String(entry.viewurl || entry.url || '')).hostname;
                        if (hostname === 'ava.ifrn.edu.br' || hostname.endsWith('.ava.ifrn.edu.br')) {
                            environment = hostname;
                        }
                    } catch {
                        // Não atribuir um ambiente com base em suposição.
                    }
                }
                environments.set(environment, (environments.get(environment) || 0) + 1);
            }
        }
        const reference = sessionStorage.getItem('ifrn_ava_test_expected') || '';
        const ownerMatches = observedOwner && reference ? observedOwner === reference : null;
        console.log('[IFRN-AVA-TEST]', JSON.stringify({ section: 'courses', counts,
            environments: Object.fromEntries(environments),
            moodleEnrolledCount: enrolled.length, panelOwnerVerified: ownerMatches }));
        return [
            ...counts.map(item => `${item.list}: ${item.count === null ? 'lista não encontrada na resposta' : item.count}`),
            ...Array.from(environments, ([environment, count]) => `${environment}: ${count} itens`),
            `Cursos matriculados no Moodle Acadêmico: ${enrolled.length}`,
            ownerMatches === true ? 'Conta do painel: corresponde à matrícula informada.'
                : ownerMatches === false ? 'Conta do painel: divergente. Não migrar.'
                    : 'Conta do painel: não foi possível confirmar automaticamente.',
            'Confira as quantidades com seu painel habitual. Inscrições abertas e outros ambientes podem explicar diferenças.',
            'Nenhum curso ou perfil do painel foi substituído.',
        ].join('\n');
    }
}
