/**
 * api.js
 * Recursos da API com cache em memória:
 * - getDashboard() → GET /dashboard/
 * - getCourse(id)  → GET /courses/{id}
 * Também monta window.MobileMoodleApi (API pública usada pelo app).
 */
(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const CACHE_TTL_MS = 60 * 1000; // cache válido por 1 minuto
    const MAX_COURSE_CACHE = 40; // evita Map crescer sem limite

    // DEMO: true força erro 500 no painel (só para testar a tela de erro).
    // Lembre de deixar false em uso normal.
    const DEMO_FORCE_500 = false;

    // Cache do dashboard (um único payload por sessão).
    const dashboardCache = {
        value: null, // último JSON recebido
        fetchedAt: 0, // timestamp do fetch
        inFlight: null, // Promise em andamento (evita requests duplicados)
    };

    // Cache por curso: courseId → { value, fetchedAt, inFlight }
    const courseCache = new Map();

    /** Retorna true se o cache ainda está dentro do TTL. */
    function isCacheFresh(fetchedAt) {
        return Boolean(fetchedAt) && Date.now() - fetchedAt < CACHE_TTL_MS;
    }

    /** Zera todos os caches (logout, pull-to-refresh forçado, etc.). */
    function invalidateCache() {
        dashboardCache.value = null;
        dashboardCache.fetchedAt = 0;
        dashboardCache.inFlight = null;
        courseCache.clear();
    }

    /**
     * Busca os dados do painel (lista de cursos + usuário).
     * @param {boolean} force — true ignora cache e busca de novo.
     */
    function getDashboard(force) {
        // Atalho de demonstração da tela 500.
        if (DEMO_FORCE_500) {
            return Promise.reject(new MM.ApiError(500));
        }

        // Cache fresco → devolve sem chamar a rede.
        if (!force && dashboardCache.value && isCacheFresh(dashboardCache.fetchedAt)) {
            return Promise.resolve(dashboardCache.value);
        }

        // Já tem um fetch rodando → reutiliza a mesma Promise.
        if (dashboardCache.inFlight && !force) {
            return dashboardCache.inFlight;
        }

        dashboardCache.inFlight = MM.request("/dashboard/")
            .then(function (data) {
                dashboardCache.value = data;
                dashboardCache.fetchedAt = Date.now();

                return data;
            })
            .finally(function () {
                dashboardCache.inFlight = null;
            });

        return dashboardCache.inFlight;
    }

    /** Remove o curso mais antigo se passar do limite do Map. */
    function pruneCourseCache() {
        if (courseCache.size <= MAX_COURSE_CACHE) {
            return;
        }

        const oldest = courseCache.keys().next().value;

        if (oldest !== undefined) {
            courseCache.delete(oldest);
        }
    }

    /**
     * Busca detalhe de um curso.
     * @param {string|number} courseId
     * @param {boolean} force
     */
    function getCourse(courseId, force) {
        const id = String(courseId);

        // Só aceita IDs numéricos (protege path da URL).
        if (!/^\d+$/.test(id)) {
            return Promise.reject(new MM.ApiError(404, "Identificador de curso inválido."));
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

        entry.inFlight = MM.request("/courses/" + encodeURIComponent(id))
            .then(function (data) {
                entry.value = data;
                entry.fetchedAt = Date.now();

                return data;
            })
            .finally(function () {
                entry.inFlight = null;
            });

        return entry.inFlight;
    }

    /** Atalho: só a lista de cursos do dashboard. */
    async function getCoursesList() {
        const dashboard = await getDashboard(false);

        return (dashboard && dashboard.courses) || [];
    }

    // Espelha no namespace interno.
    MM.invalidateCache = invalidateCache;
    MM.getDashboard = getDashboard;
    MM.getCourse = getCourse;
    MM.getCoursesList = getCoursesList;

    // API pública consumida por app-router.js / app.js.
    window.MobileMoodleApi = {
        setApiBaseUrl: MM.setApiBaseUrl,
        getToken: MM.getToken,
        setToken: MM.setToken,
        clearToken: MM.clearToken,
        invalidateCache: invalidateCache,
        getCoursesList: getCoursesList,
        getDashboard: getDashboard,
        getCourse: getCourse,
    };
})(window);
