(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const CACHE_TTL_MS = 60 * 1000;
    const MAX_COURSE_CACHE = 40;

    // DEMO: true = força tela de erro 500 no painel. Volte para false depois do teste.
    const DEMO_FORCE_500 = true;

    const dashboardCache = {
        value: null,
        fetchedAt: 0,
        inFlight: null,
    };

    const courseCache = new Map();

    function isCacheFresh(fetchedAt) {
        return Boolean(fetchedAt) && Date.now() - fetchedAt < CACHE_TTL_MS;
    }

    function invalidateCache() {
        dashboardCache.value = null;
        dashboardCache.fetchedAt = 0;
        dashboardCache.inFlight = null;
        courseCache.clear();
    }

    function getDashboard(force) {
        if (DEMO_FORCE_500) {
            return Promise.reject(new MM.ApiError(500));
        }

        if (!force && dashboardCache.value && isCacheFresh(dashboardCache.fetchedAt)) {
            return Promise.resolve(dashboardCache.value);
        }

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

    function pruneCourseCache() {
        if (courseCache.size <= MAX_COURSE_CACHE) {
            return;
        }

        const oldest = courseCache.keys().next().value;

        if (oldest !== undefined) {
            courseCache.delete(oldest);
        }
    }

    function getCourse(courseId, force) {
        const id = String(courseId);

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

    async function getCoursesList() {
        const dashboard = await getDashboard(false);

        return (dashboard && dashboard.courses) || [];
    }

    MM.invalidateCache = invalidateCache;
    MM.getDashboard = getDashboard;
    MM.getCourse = getCourse;
    MM.getCoursesList = getCoursesList;

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
