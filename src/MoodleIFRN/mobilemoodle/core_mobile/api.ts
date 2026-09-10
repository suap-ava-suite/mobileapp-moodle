/**
 * api.ts
 * ----------------------------------------------------------------------------
 * Fachada de dados do painel + cache em memória.
 *
 * Fonte: API oficial do SUAP (JWT do login IFRN).
 *   GET /api/rh/eu/ + diários  → getDashboard()
 *   GET turma/diário            → getCourse(id)
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

        dashboardCache.inFlight = MM.fetchSuapDashboard()
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

        entry.inFlight = MM.fetchSuapCourse(id)
            .then((course) => {
                entry!.value = course;
                entry!.fetchedAt = Date.now();

                return course;
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
