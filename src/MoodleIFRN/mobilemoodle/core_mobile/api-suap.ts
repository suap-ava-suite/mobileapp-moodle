/*!
 * api-suap.ts
 * ----------------------------------------------------------------------------
 * Adapta endpoints oficiais do SUAP para o formato interno do painel
 * (DashboardData / CourseData).
 *
 * Autenticação: Bearer JWT de POST /api/token/pair
 * Docs: https://suap.ifrn.edu.br/api/docs/
 */
import { MM } from './namespace';

interface SuapEu {
    nome?: string;
    nome_usual?: string;
    nome_social?: string;
    foto?: string;
    tipo_usuario?: string;
    identificacao?: string;
}

interface SuapPeriodo {
    ano_letivo: number;
    periodo_letivo: number;
}

interface SuapDisciplina {
    id?: number;
    descricao?: string | null;
    sigla?: string;
    ch_total_aula?: number;
    ch_cumprida_aula?: number;
    frequencia?: number;
}

interface SuapProfessor {
    nome?: string;
    nome_usual?: string | null;
}

interface SuapDiario {
    id: number;
    disciplina?: SuapDisciplina;
    professores?: SuapProfessor[] | null;
    ambiente_virtual?: string;
    componente_curricular?: string;
}

interface SuapAula {
    data?: string;
    etapa?: number | string;
    conteudo?: string;
    professor?: string;
    quantidade?: number;
}

interface SuapMaterial {
    url?: string;
    descricao?: string;
    data_vinculacao?: string;
}

interface SuapTopico {
    id?: number;
    titulo?: string;
    descricao?: string;
    etapa?: string;
}

interface SuapTurmaVirtual {
    id?: number;
    componente_curricular?: string;
    professores?: Array<{ nome?: string; nome_usual?: string }>;
    aulas?: SuapAula[];
    materiais_de_aula?: SuapMaterial[];
    ano_letivo?: string | number;
    periodo_letivo?: string | number;
}

function asPagedResults<T>(data: unknown): T[] {
    if (Array.isArray(data)) {
        return data as T[];
    }

    if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
        return (data as { results: T[] }).results;
    }

    return [];
}

function absoluteSuapUrl(pathOrUrl: string | undefined): string | undefined {
    if (!pathOrUrl) {
        return undefined;
    }

    if (/^https?:\/\//i.test(pathOrUrl) || pathOrUrl.startsWith('data:')) {
        return pathOrUrl;
    }

    if (pathOrUrl.startsWith('/')) {
        return 'https://suap.ifrn.edu.br' + pathOrUrl;
    }

    return pathOrUrl;
}

function displayName(eu: SuapEu): string {
    return (
        eu.nome_social ||
        eu.nome_usual ||
        eu.nome ||
        eu.identificacao ||
        'Usuário SUAP'
    );
}

function roleFromTipo(tipo: string | undefined): string {
    const value = (tipo || '').toLowerCase();

    if (value.includes('servidor') || value.includes('professor') || value.includes('docente')) {
        return 'coordenador';
    }

    return 'estudante';
}

function latestPeriod(periods: SuapPeriodo[]): SuapPeriodo | null {
    if (!periods.length) {
        return null;
    }

    return periods.reduce((best, current) => {
        if (
            current.ano_letivo > best.ano_letivo ||
            (current.ano_letivo === best.ano_letivo &&
                current.periodo_letivo > best.periodo_letivo)
        ) {
            return current;
        }

        return best;
    });
}

function progressFromDisciplina(disciplina?: SuapDisciplina): number | null {
    if (!disciplina) {
        return null;
    }

    const total = Number(disciplina.ch_total_aula || 0);
    const done = Number(disciplina.ch_cumprida_aula || 0);

    if (total > 0) {
        return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
    }

    if (typeof disciplina.frequencia === 'number') {
        return Math.max(0, Math.min(100, Math.round(disciplina.frequencia)));
    }

    return null;
}

function mapDiarioToCourse(diario: SuapDiario): DashboardCourse {
    const disciplina = diario.disciplina;
    const name =
        diario.componente_curricular ||
        disciplina?.descricao ||
        disciplina?.sigla ||
        `Diário ${diario.id}`;
    const progress = progressFromDisciplina(disciplina);

    return {
        id: diario.id,
        name,
        fullname: name,
        shortname: disciplina?.sigla || String(diario.id),
        progress,
        hasprogress: progress != null,
        moodle: diario.ambiente_virtual || 'SUAP',
        is_enrolled: true,
        enrolled: true,
    };
}

function isApiError(error: unknown): error is ApiErrorShape {
    return Boolean(
        error &&
        typeof error === 'object' &&
        typeof (error as ApiErrorShape).status === 'number',
    );
}

async function softGet<T>(path: string): Promise<T | null> {
    try {
        return await MM.request(path, { softAuth: true }) as T;
    } catch (error) {
        if (isApiError(error) &&
            (error.status === 404 || error.status === 403 || error.status === 400)) {
            return null;
        }

        throw error;
    }
}

async function fetchStudentDiarios(period: SuapPeriodo): Promise<SuapDiario[]> {
    const semestre = `${period.ano_letivo}.${period.periodo_letivo}`;
    const bySemestre = await softGet(`/api/ensino/diarios/${encodeURIComponent(semestre)}/`);

    if (bySemestre) {
        return asPagedResults<SuapDiario>(bySemestre);
    }

    const byPeriod = await softGet(
        `/api/ensino/meus-diarios/${period.ano_letivo}/${period.periodo_letivo}/`,
    );

    if (byPeriod) {
        return asPagedResults<SuapDiario>(byPeriod);
    }

    return [];
}

async function fetchOpenDiarios(): Promise<SuapDiario[]> {
    const open = await softGet('/api/ensino/meus-diarios/');

    return open ? asPagedResults<SuapDiario>(open) : [];
}

/**
 * Monta o dashboard do painel a partir do SUAP.
 */
async function fetchSuapDashboard(): Promise<DashboardData> {
    const eu = await MM.request('/api/rh/eu/') as SuapEu;
    const periodsRaw = await softGet('/api/ensino/meus-periodos-letivos/');
    const periods = periodsRaw ? asPagedResults<SuapPeriodo>(periodsRaw) : [];
    const period = latestPeriod(periods);

    let diarios: SuapDiario[] = [];

    if (period) {
        diarios = await fetchStudentDiarios(period);
    }

    if (!diarios.length) {
        diarios = await fetchOpenDiarios();
    }

    const courses = diarios.map(mapDiarioToCourse);
    const username =
        typeof sessionStorage !== 'undefined'
            ? sessionStorage.getItem('ifrn_username') || undefined
            : undefined;

    return {
        nome: displayName(eu),
        username,
        foto_url: absoluteSuapUrl(eu.foto),
        foto: absoluteSuapUrl(eu.foto),
        avatar_url: absoluteSuapUrl(eu.foto),
        papel: roleFromTipo(eu.tipo_usuario),
        role: roleFromTipo(eu.tipo_usuario),
        courses,
        diarios: courses,
        autoinscricoes: [],
        self_enrolments: [],
        total_courses: courses.length,
        filtro_situacao: 'inprogress',
        situacao: 'inprogress',
    } as DashboardData;
}

function teachersLabel(professores: SuapProfessor[] | undefined): string {
    if (!professores || !professores.length) {
        return 'Professor(a) não informado';
    }

    return professores
        .map((item) => item.nome_usual || item.nome || '')
        .filter(Boolean)
        .join(', ') || 'Professor(a) não informado';
}

function sectionsFromTurma(turma: SuapTurmaVirtual): CourseSection[] {
    const sections: CourseSection[] = [];
    const aulas = Array.isArray(turma.aulas) ? turma.aulas : [];
    const materiais = Array.isArray(turma.materiais_de_aula) ? turma.materiais_de_aula : [];

    if (aulas.length) {
        sections.push({
            name: 'Aulas',
            activities: aulas.map((aula) => ({
                name: aula.conteudo || `Aula ${aula.data || ''}`.trim(),
                modname: 'lesson',
                completion: false,
            })),
        });
    }

    if (materiais.length) {
        sections.push({
            name: 'Materiais',
            activities: materiais.map((material) => ({
                name: material.descricao || 'Material',
                modname: 'resource',
                completion: false,
            })),
        });
    }

    return sections;
}

async function sectionsFromDiarioEndpoints(diarioId: string): Promise<CourseSection[]> {
    const [aulasRaw, materiaisRaw, topicosRaw] = await Promise.all([
        softGet(`/api/ensino/diarios/${encodeURIComponent(diarioId)}/aulas/`),
        softGet(`/api/ensino/diarios/${encodeURIComponent(diarioId)}/materiais/`),
        softGet(`/api/ensino/diarios/${encodeURIComponent(diarioId)}/topicos/`),
    ]);

    const sections: CourseSection[] = [];
    const aulas = asPagedResults<SuapAula>(aulasRaw);
    const materiais = asPagedResults<SuapMaterial>(materiaisRaw);
    const topicos = asPagedResults<SuapTopico>(topicosRaw);

    if (aulas.length) {
        sections.push({
            name: 'Aulas',
            activities: aulas.map((aula) => ({
                name: aula.conteudo || `Aula ${aula.data || ''}`.trim(),
                modname: 'lesson',
                completion: false,
            })),
        });
    }

    if (materiais.length) {
        sections.push({
            name: 'Materiais',
            activities: materiais.map((material) => ({
                name: material.descricao || 'Material',
                modname: 'resource',
                completion: false,
            })),
        });
    }

    if (topicos.length) {
        sections.push({
            name: 'Tópicos',
            activities: topicos.map((topico) => ({
                name: topico.titulo || topico.descricao || `Tópico ${topico.id || ''}`,
                modname: 'forum',
                completion: false,
            })),
        });
    }

    return sections;
}

/**
 * Detalhe de um diário/turma no formato CourseData do painel.
 */
async function fetchSuapCourse(courseId: string): Promise<CourseData> {
    const turma = await softGet<SuapTurmaVirtual>(
        `/api/ensino/minha-turma-virtual/${encodeURIComponent(courseId)}/`,
    );

    if (turma) {
        const name = turma.componente_curricular || `Diário ${courseId}`;

        return {
            id: turma.id || Number(courseId),
            name,
            teacher: teachersLabel(turma.professores as SuapProfessor[]),
            workload: '',
            progress: 0,
            moodle: 'SUAP',
            summary: [
                turma.ano_letivo && turma.periodo_letivo
                    ? `Período ${turma.ano_letivo}.${turma.periodo_letivo}`
                    : '',
            ].filter(Boolean).join(' · '),
            sections: sectionsFromTurma(turma),
        };
    }

    const professoresRaw = await softGet(
        `/api/ensino/diarios/${encodeURIComponent(courseId)}/professores/`,
    );
    const sections = await sectionsFromDiarioEndpoints(courseId);
    const professores = asPagedResults<SuapProfessor>(professoresRaw);

    if (!sections.length && !professores.length) {
        throw new MM.ApiError(404, 'Diário não encontrado no SUAP.');
    }

    return {
        id: Number(courseId),
        name: `Diário ${courseId}`,
        teacher: teachersLabel(professores),
        workload: '',
        progress: 0,
        moodle: 'SUAP',
        summary: '',
        sections,
    };
}

MM.fetchSuapDashboard = fetchSuapDashboard;
MM.fetchSuapCourse = fetchSuapCourse;
