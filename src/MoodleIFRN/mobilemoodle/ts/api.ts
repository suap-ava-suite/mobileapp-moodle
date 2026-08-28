/**
 * api.ts
 * getDashboard / getCourse com cache em memória e fachada MobileMoodleApi.
 */
(function (window: Window) {
    'use strict';

    const MM = (window.MobileMoodle = window.MobileMoodle || ({} as MobileMoodleNamespace));
    const CACHE_TTL_MS = 60 * 1000;
    const MAX_COURSE_CACHE = 40;
    const DEMO_FORCE_500 = false;

    interface DashboardCacheEntry {
        value: DashboardData | null;
        fetchedAt: number;
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

        dashboardCache.inFlight = MM.request('/dashboard/')
            .then((data: unknown) => {
                const dashboard = data as DashboardData;

                dashboardCache.value = dashboard;
                dashboardCache.fetchedAt = Date.now();

                return dashboard;
            })
            .finally(() => {
                dashboardCache.inFlight = null;
            });

        return dashboardCache.inFlight;
    }

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

        entry.inFlight = MM.request('/courses/' + encodeURIComponent(id))
            .then((data: unknown) => {
                const course = data as CourseData;

                entry!.value = course;
                entry!.fetchedAt = Date.now();

                return course;
            })
            .finally(() => {
                entry!.inFlight = null;
            });

        return entry.inFlight;
    }

    async function getCoursesList(): Promise<DashboardCourse[]> {
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
        invalidateCache,
        getCoursesList,
        getDashboard,
        getCourse,
    };
})(window);
