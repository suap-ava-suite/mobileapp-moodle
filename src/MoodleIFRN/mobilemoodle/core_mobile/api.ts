/*!
 * api.ts
 * ----------------------------------------------------------------------------
 * Fachada de dados do painel + cache em memória.
 *
 * Fonte do painel:
 *   Painel AVA (/api/v2/sala/tipo/diario/*/
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
    const forcedCourseRequests = new WeakSet<Promise<CourseData>>();
    let cacheGeneration = 0;
    let dashboardRequestIsForced = false;

    function isCacheFresh(fetchedAt: number): boolean {
        return Boolean(fetchedAt) && Date.now() - fetchedAt < CACHE_TTL_MS;
    }

    function invalidateCache(): void {
        // Respostas já iniciadas podem chegar depois do logout ou da troca de
        // conta. A geração impede que elas publiquem dados no cache novo.
        cacheGeneration++;
        dashboardCache.value = null;
        dashboardCache.fetchedAt = 0;
        dashboardCache.inFlight = null;
        dashboardRequestIsForced = false;
        courseCache.clear();
    }

    /**
     * Cards de curso vêm exclusivamente do Painel AVA, porque somente esse
     * contrato fornece o courseid/viewurl reais do Moodle.
     * Não mascarar falha com diários SUAP (IDs acadêmicos != courseid Moodle).
     */
    async function fetchDashboardPreferPainel(): Promise<DashboardData> {
        if (typeof MM.hasPainelSession !== 'function' || !MM.hasPainelSession()) {
            // eslint-disable-next-line no-console
            console.error('[IFRN-PANEL] sessão Painel AVA ausente — fallback SUAP desativado');
            throw new MM.ApiError(401, 'Sessão do Painel AVA ausente. Entre novamente para carregar os cursos reais do Moodle.');
        }

        // eslint-disable-next-line no-console
        console.log('[IFRN-PANEL] buscando diarios no Painel AVA');

        return MM.fetchPainelDashboard();
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

        if (dashboardCache.inFlight && (!force || dashboardRequestIsForced)) {
            return dashboardCache.inFlight;
        }

        const generation = cacheGeneration;
        const request = fetchDashboardPreferPainel()
            .then((dashboard) => {
                if (generation !== cacheGeneration) {
                    throw new MM.ApiError(401, 'A sessão mudou durante o carregamento. Atualize o Painel.');
                }

                // Uma atualização forçada mais nova é a única que pode publicar
                // enquanto ambas as respostas ainda estão em trânsito.
                if (dashboardCache.inFlight === request) {
                    dashboardCache.value = dashboard;
                    dashboardCache.fetchedAt = Date.now();
                }

                return dashboard;
            })
            .finally(() => {
                if (dashboardCache.inFlight === request) {
                    dashboardCache.inFlight = null;
                    dashboardRequestIsForced = false;
                }
            });
        dashboardCache.inFlight = request;
        dashboardRequestIsForced = force;

        return request;
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
        const currentEntry = entry;

        if (!force && currentEntry.value && isCacheFresh(currentEntry.fetchedAt)) {
            return Promise.resolve(currentEntry.value);
        }

        if (currentEntry.inFlight && (!force || forcedCourseRequests.has(currentEntry.inFlight))) {
            return currentEntry.inFlight;
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
                summary: 'Toque no card do curso para abrir o conteúdo nativo do Moodle Mobile.',
            };

            entry.value = course;
            entry.fetchedAt = Date.now();

            return Promise.resolve(course);
        }

        const generation = cacheGeneration;
        const request = MM.fetchSuapCourse(id)
            .then((course) => {
                if (generation !== cacheGeneration) {
                    throw new MM.ApiError(401, 'A sessão mudou durante o carregamento do curso. Tente novamente.');
                }

                const enriched = enrichCourseFromDashboard(course, id);
                if (courseCache.get(id) === currentEntry && currentEntry.inFlight === request) {
                    currentEntry.value = enriched;
                    currentEntry.fetchedAt = Date.now();
                }

                return enriched;
            })
            .finally(() => {
                if (currentEntry.inFlight === request) {
                    currentEntry.inFlight = null;
                }
            });
        if (force) {
            forcedCourseRequests.add(request);
        }
        currentEntry.inFlight = request;

        return request;
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
