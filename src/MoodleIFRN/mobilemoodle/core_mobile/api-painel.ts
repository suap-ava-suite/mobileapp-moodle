/*!
 * api-painel.ts
 * ----------------------------------------------------------------------------
 * Consome o Painel AVA oficial (djangoapp-painel_ava):
 *   GET https://painel.ead.ifrn.edu.br/api/v1/diarios/
 *
 * Autenticação: JWT do Painel (POST /api/v1/authenticate/), NÃO o JWT SUAP
 * e NÃO wstoken Moodle.
 *
 * Cada diário traz courseid Moodle (`id`), viewurl e diario_id SUAP.
 */
import { MM } from './namespace';

const PAINEL_BASE = 'https://painel.ead.ifrn.edu.br';
const PAINEL_TOKEN_KEY = 'ifrn_painel_token';
const PAINEL_PROFILE_KEY = 'ifrn_painel_profile';
const REQUEST_TIMEOUT_MS = 15000;

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

function getPainelToken(): string | null {
    const stored = sessionStorage.getItem(PAINEL_TOKEN_KEY);

    if (!stored) {
        return null;
    }

    // Reusa validador JWT do painel (formato + exp).
    if (typeof MM.isValidToken === 'function' && !MM.isValidToken(stored)) {
        sessionStorage.removeItem(PAINEL_TOKEN_KEY);

        return null;
    }

    return stored;
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
        return new URL(viewurl).origin;
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

async function requestPainel(path: string): Promise<unknown> {
    const token = getPainelToken();

    if (!token) {
        throw new MM.ApiError(401, 'Sessão do Painel AVA ausente.');
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
        controller.abort();
    }, REQUEST_TIMEOUT_MS);

    let response: Response;

    try {
        response = await fetch(PAINEL_BASE + path, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer ' + token,
            },
            credentials: 'omit',
            cache: 'no-store',
            signal: controller.signal,
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new MM.ApiError(408);
        }

        throw new MM.ApiError(0, 'Falha de rede ao consultar o Painel AVA.');
    } finally {
        window.clearTimeout(timeoutId);
    }

    if (response.status === 401 || response.status === 403 || response.status === 428) {
        throw new MM.ApiError(response.status, 'Sessão do Painel AVA inválida.');
    }

    if (!response.ok) {
        throw new MM.ApiError(response.status);
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
        throw new MM.ApiError(502, 'Resposta inválida do Painel AVA.');
    }

    return response.json();
}

function profileDisplayName(profile: Record<string, unknown> | null): string {
    if (!profile) {
        return 'Usuário';
    }

    const nome =
        profile['nome'] ||
        profile['nome_usual'] ||
        profile['nome_registro'] ||
        profile['nome_social'];

    return typeof nome === 'string' && nome.trim() ? nome.trim() : 'Usuário';
}

/**
 * Dashboard a partir do Painel AVA (courseids Moodle reais).
 */
async function fetchPainelDashboard(): Promise<DashboardData> {
    const data = await requestPainel('/api/v1/diarios/?situacao=inprogress') as PainelDiariosResponse;
    const profile = readPainelProfile();
    const diarios = (data.diarios || []).map(mapPainelDiario);
    const autoinscricoes = (data.autoinscricoes || []).map(mapPainelDiario);

    return {
        nome: profileDisplayName(profile),
        username: typeof profile?.['matricula'] === 'string'
            ? profile['matricula']
            : (typeof profile?.['username'] === 'string' ? profile['username'] : undefined),
        foto_url: typeof profile?.['url_foto_150x200'] === 'string'
            ? profile['url_foto_150x200']
            : (typeof profile?.['foto'] === 'string' ? profile['foto'] : undefined),
        papel: 'estudante',
        total_courses: diarios.length,
        courses: diarios,
        diarios,
        autoinscricoes,
        source: 'painel',
    };
}

function hasPainelSession(): boolean {
    return getPainelToken() !== null;
}

MM.fetchPainelDashboard = fetchPainelDashboard;
MM.hasPainelSession = hasPainelSession;
MM.getPainelToken = getPainelToken;
