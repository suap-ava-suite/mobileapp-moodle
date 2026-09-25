/*!
 * api.ts
 * ----------------------------------------------------------------------------
 * Fachada de dados do painel + cache em memória.
 *
 * Preferência:
 *   1. Painel AVA (/api/v1/diarios/) — courseid Moodle real
 *   2. Fallback SUAP (/api/ensino/…) — só metadados acadêmicos
 *
 * Cache:
 *   - TTL 60s
 *   - inFlight evita requests duplicados em paralelo
 *   - cursos: Map com no máximo 40 entradas (FIFO simples)
 *
 * Também monta window.MobileMoodleApi (API pública para o app Ionic / login).
 *
 * DEMO_FORCE_500: deixe false em produção; true só para testar tela de erro.
 */
import { MM } from './namespace';

    const CACHE_TTL_MS = 60 * 1000;
    const MAX_COURSE_CACHE = 40;
    const DEMO_FORCE_500 = false;

    interface DashboardCacheEntry {
        value: DashboardData | null;
        fetchedAt: number;
        /** Promise em andamento — quem pedir de novo reusa a mesma. */
        inFlight: Promise<DashboardData> | null;
    }

    const dashboardCache: DashboardCacheEntry = {
        value: null,
        fetchedAt: 0,
        inFlight: null,
    };

    const courseCache = new Map<string, CourseCacheEntry>();

    function isCacheFresh(fetchedAt: number): boolean {
        return Boolean(fetchedAt) && Date.now() - fetchedAt < CACHE_TTL_MS;
    }

    function invalidateCache(): void {
        dashboardCache.value = null;
        dashboardCache.fetchedAt = 0;
        dashboardCache.inFlight = null;
        courseCache.clear();
    }

    /**
     * Painel AVA primeiro; se falhar ou não houver JWT do Painel, usa SUAP.
     */
    async function fetchDashboardPreferPainel(): Promise<DashboardData> {
        if (typeof MM.hasPainelSession === 'function' && MM.hasPainelSession()) {
            try {
                return await MM.fetchPainelDashboard();
            } catch (error) {
                // eslint-disable-next-line no-console
                console.warn('[Painel AVA] Falha ao listar diários; fallback SUAP.', error);
            }
        }

        return MM.fetchSuapDashboard();
    }

    /**
     * @param force se true, ignora cache e refaz o GET (pull-to-refresh / retry).
     */
    function getDashboard(force = false): Promise<DashboardData> {
        if (DEMO_FORCE_500) {
            return Promise.reject(new MM.ApiError(500));
        }

        if (!force && dashboardCache.value && isCacheFresh(dashboardCache.fetchedAt)) {
            return Promise.resolve(dashboardCache.value);
        }

        if (dashboardCache.inFlight && !force) {
            return dashboardCache.inFlight;
        }

        dashboardCache.inFlight = fetchDashboardPreferPainel()
            .then((dashboard) => {
                dashboardCache.value = dashboard;
                dashboardCache.fetchedAt = Date.now();

                return dashboard;
            })
            .finally(() => {
                dashboardCache.inFlight = null;
            });

        return dashboardCache.inFlight;
    }

    /** Remove a entrada mais antiga quando o Map passa do limite. */
    function pruneCourseCache(): void {
        if (courseCache.size <= MAX_COURSE_CACHE) {
            return;
        }

        const oldest = courseCache.keys().next().value;

        if (oldest !== undefined) {
            courseCache.delete(oldest);
        }
    }

    function enrichCourseFromDashboard(course: CourseData, id: string): CourseData {
        const dashboard = dashboardCache.value;
        const fromList = (dashboard?.diarios || dashboard?.courses || [])
            .find((item) => String(item.id) === id);

        if (!fromList || fromList.source !== 'painel') {
            return course;
        }

        return {
            ...course,
            id: fromList.id,
            name: fromList.name || course.name,
            moodle: fromList.moodle || course.moodle,
            external_url: fromList.viewurl || fromList.details_url || course.external_url,
            moodle_course_id: fromList.moodle_course_id,
            moodle_site_url: fromList.moodle_site_url,
            source: 'painel',
        };
    }

    function getCourse(courseId: string | number, force = false): Promise<CourseData> {
        const id = String(courseId);

        // Só IDs numéricos (bate com a rota #/curso/123)
        if (!/^\d+$/.test(id)) {
            return Promise.reject(new MM.ApiError(404, 'Identificador de curso inválido.'));
        }

        let entry = courseCache.get(id);

        if (!entry) {
            entry = { value: null, fetchedAt: 0, inFlight: null };
            courseCache.set(id, entry);
            pruneCourseCache();
        }

        if (!force && entry.value && isCacheFresh(entry.fetchedAt)) {
            return Promise.resolve(entry.value);
        }

        if (entry.inFlight && !force) {
            return entry.inFlight;
        }

        // Card do Painel já tem courseid Moodle: monta detalhe mínimo sem SUAP.
        const fromPainel = (dashboardCache.value?.diarios || dashboardCache.value?.courses || [])
            .find((item) => String(item.id) === id && item.source === 'painel');

        if (fromPainel) {
            const course: CourseData = {
                id: fromPainel.id,
                name: fromPainel.name,
                moodle: fromPainel.moodle,
                progress: fromPainel.progress ?? undefined,
                external_url: fromPainel.viewurl || fromPainel.details_url,
                moodle_course_id: fromPainel.moodle_course_id,
                moodle_site_url: fromPainel.moodle_site_url,
                source: 'painel',
                sections: [],
                summary: 'Toque em “Abrir no Moodle” para o conteúdo nativo do AVA.',
            };

            entry.value = course;
            entry.fetchedAt = Date.now();

            return Promise.resolve(course);
        }

        entry.inFlight = MM.fetchSuapCourse(id)
            .then((course) => {
                const enriched = enrichCourseFromDashboard(course, id);
                entry!.value = enriched;
                entry!.fetchedAt = Date.now();

                return enriched;
            })
            .finally(() => {
                entry!.inFlight = null;
            });

        return entry.inFlight;
    }

    /** Atalho: só a lista `courses` do dashboard. */
    async function getCoursesList(): Promise<DashboardCourse[]> {
        const dashboard = await getDashboard(false);

        return (dashboard && dashboard.courses) || [];
    }

    MM.invalidateCache = invalidateCache;
    MM.getDashboard = getDashboard;
    MM.getCourse = getCourse;
    MM.getCoursesList = getCoursesList;

    // API estável para quem está fora do namespace interno (login Ionic, etc.)
    window.MobileMoodleApi = {
        setApiBaseUrl: MM.setApiBaseUrl,
        getToken: MM.getToken,
        setToken: MM.setToken,
        clearToken: MM.clearToken,
        invalidateCache,
        getCoursesList,
        getDashboard,
        getCourse,
    };
