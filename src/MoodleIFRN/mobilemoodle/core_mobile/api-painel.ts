/*!
 * api-painel.ts
 * ----------------------------------------------------------------------------
 * Consome o Painel AVA oficial (djangoapp-painel_ava):
 *   GET https://ava.ifrn.edu.br/api/v1/diarios/
 */

import { MM } from './namespace';

const PAINEL_DASHBOARD_KEY = 'ifrn_painel_dashboard';
const PAINEL_PROFILE_KEY = 'ifrn_painel_profile';
const PAINEL_OWNER_KEY = 'ifrn_painel_owner';
const IFRN_USERNAME_KEY = 'ifrn_username';

interface PainelAmbiente {
    id?: number;
    titulo?: string;
    cor_mestra?: string;
}

interface PainelDiario {
    id?: number | string;
    fullname?: string;
    shortname?: string;
    progress?: number | null;
    hasprogress?: boolean;
    isfavourite?: boolean;
    favourite?: boolean;
    visible?: number | boolean | string;
    viewurl?: string;
    url?: string;
    details_url?: string;
    is_enrolled?: boolean;
    diario_id?: string | number;
    id_diario?: string;
    id_diario_clean?: number;
    diario?: { id?: string; id_clean?: number };
    ambiente?: PainelAmbiente;
    disciplina?: { sigla?: string; descricao?: string };
}

interface PainelDiariosResponse {
    diarios?: PainelDiario[];
    autoinscricoes?: PainelDiario[];
    coordenacoes?: PainelDiario[];
    praticas?: PainelDiario[];
}

function normalizeOwner(value: string | null | undefined): string {
    return (value || '').trim().toLowerCase();
}

function readPainelDashboard(): PainelDiariosResponse | PainelDiario[] | null {
    const raw = sessionStorage.getItem(PAINEL_DASHBOARD_KEY);

    if (!raw) {
        return null;
    }

    const owner = normalizeOwner(sessionStorage.getItem(PAINEL_OWNER_KEY));
    const current = normalizeOwner(sessionStorage.getItem(IFRN_USERNAME_KEY));

    // Dashboard de outra conta → descarta (troca de login).
    if (owner && current && owner !== current) {
        sessionStorage.removeItem(PAINEL_DASHBOARD_KEY);
        sessionStorage.removeItem(PAINEL_OWNER_KEY);
        sessionStorage.removeItem(PAINEL_PROFILE_KEY);

        return null;
    }

    try {
        const parsed: unknown = JSON.parse(raw);

        if (Array.isArray(parsed)) {
            return parsed as PainelDiario[];
        }

        if (parsed && typeof parsed === 'object') {
            return parsed as PainelDiariosResponse;
        }

        return null;
    } catch {
        sessionStorage.removeItem(PAINEL_DASHBOARD_KEY);

        return null;
    }
}

function readPainelProfile(): Record<string, unknown> | null {
    const raw = sessionStorage.getItem(PAINEL_PROFILE_KEY);

    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function extractSiteUrl(viewurl: string | undefined): string | undefined {
    if (!viewurl || !/^https?:\/\//i.test(viewurl)) {
        return undefined;
    }

    try {
        const origin = new URL(viewurl).origin;
        const host = new URL(origin).hostname.toLowerCase();

        // Mock / ambiente local NÃO é Moodle Mobile (sem public config / wstoken).
        if (
            host === 'localhost'
            || host === '127.0.0.1'
            || host === '10.0.2.2'
            || host.endsWith('.local')
            || host.endsWith('.localhost')
        ) {
            return undefined;
        }

        return origin;
    } catch {
        return undefined;
    }
}

function diarioSuapId(diario: PainelDiario): number | undefined {
    if (typeof diario.id_diario_clean === 'number') {
        return diario.id_diario_clean;
    }

    if (diario.diario?.id_clean != null) {
        return Number(diario.diario.id_clean);
    }

    const raw = diario.diario_id ?? diario.id_diario ?? diario.diario?.id;

    if (raw == null) {
        return undefined;
    }

    const asNum = Number(String(raw).replace(/^#/, ''));

    return Number.isFinite(asNum) ? asNum : undefined;
}

function mapPainelDiario(diario: PainelDiario): DashboardCourse {
    const courseId = Number(diario.id);
    const name =
        diario.fullname ||
        diario.disciplina?.descricao ||
        diario.shortname ||
        `Curso ${diario.id}`;
    const viewurl = diario.viewurl || diario.url;
    const ambienteTitulo = diario.ambiente?.titulo;

    return {
        id: Number.isFinite(courseId) ? courseId : diario.id || 0,
        name,
        fullname: name,
        shortname: diario.shortname || diario.disciplina?.sigla || String(diario.id),
        progress: diario.progress ?? null,
        hasprogress: Boolean(diario.hasprogress),
        moodle: ambienteTitulo || 'AVA',
        environment: ambienteTitulo,
        ambiente: diario.ambiente,
        isfavourite: Boolean(diario.isfavourite || diario.favourite),
        favourite: Boolean(diario.isfavourite || diario.favourite),
        is_enrolled: diario.is_enrolled !== false,
        enrolled: diario.is_enrolled !== false,
        details_url: viewurl || diario.details_url,
        viewurl,
        moodle_course_id: Number.isFinite(courseId) ? courseId : undefined,
        moodle_site_url: extractSiteUrl(viewurl),
        diario_id: diarioSuapId(diario),
        source: 'painel',
    };
}

function profileDisplayName(profile: Record<string, unknown> | null): string {
    if (!profile) {
        return sessionStorage.getItem(IFRN_USERNAME_KEY) || 'Usuário';
    }

    // Mesma prioridade usada pelo fluxo antigo do SUAP.
    const nome =
        profile['nome_social'] ||
        profile['nome_usual'] ||
        profile['nome'] ||
        profile['nome_registro'] ||
        profile['nome_completo'] ||
        profile['name'] ||
        profile['display_name'];

    if (typeof nome === 'string') {
        const value = nome.trim();
        if (value && !/^(usuário|usuario|perfil|avatar|imagem de perfil)$/i.test(value)) {
            return value;
        }
    }

    return sessionStorage.getItem(IFRN_USERNAME_KEY) || 'Usuário';
}

/**
 * Dashboard a partir do Painel AVA (courseids Moodle reais).
 */
async function fetchPainelDashboard(): Promise<DashboardData> {
    const data = readPainelDashboard();

    if (!data) {
        throw new MM.ApiError(401, 'Dados do Painel AVA ausentes.');
    }

    let profile = readPainelProfile();

    // O endpoint de diários do Painel não traz necessariamente o perfil. Quando
    // o JWT SUAP ainda estiver disponível, busca o próprio usuário uma vez e
    // persiste apenas os dados de perfil necessários à interface/identidade.
    if (!profile && typeof MM.getToken === 'function' && MM.getToken()) {
        try {
            const suapProfile = await MM.request('/api/rh/eu/', { softAuth: true });

            if (suapProfile && typeof suapProfile === 'object' && !Array.isArray(suapProfile)) {
                profile = suapProfile as Record<string, unknown>;
                sessionStorage.setItem(PAINEL_PROFILE_KEY, JSON.stringify(profile));
            }
        } catch {
            // Perfil é complementar: o dashboard Painel continua válido sem ele.
        }
    }

    // O Angular obtém este JSON dentro de ava.ifrn.edu.br via OAuth/cookie e o
    // salva em sessionStorage. O mobilemoodle apenas consome a cópia local.
    const rawDiarios = Array.isArray(data) ? data : (data.diarios || []);
    const rawCoordenacoes = Array.isArray(data) ? [] : (data.coordenacoes || []);
    const rawAutoinscricoes = Array.isArray(data) ? [] : (data.autoinscricoes || []);

    const diarios = rawDiarios.map(mapPainelDiario);
    const coordenacoes = rawCoordenacoes.map(mapPainelDiario);
    const autoinscricoes = rawAutoinscricoes.map(mapPainelDiario);
    const courses = [...diarios, ...coordenacoes, ...autoinscricoes];

    // eslint-disable-next-line no-console
    console.log(`[IFRN-PANEL] dashboard local carregado; ${diarios.length} diário(s)`);

    return {
        nome: profileDisplayName(profile),
        username: typeof profile?.['matricula'] === 'string'
            ? profile['matricula']
            : (typeof profile?.['username'] === 'string' ? profile['username'] : undefined),
        foto_url: typeof profile?.['url_foto_150x200'] === 'string'
            ? profile['url_foto_150x200']
            : (typeof profile?.['foto'] === 'string' ? profile['foto'] : undefined),
        papel: 'estudante',
        total_courses: courses.length,
        courses,
        diarios,
        coordenacoes,
        autoinscricoes,
        source: 'painel',
    };
}


function hasPainelSession(): boolean {
    return readPainelDashboard() !== null;
}

MM.fetchPainelDashboard = fetchPainelDashboard;
MM.hasPainelSession = hasPainelSession;
MM.getPainelToken = (): string | null => null;
