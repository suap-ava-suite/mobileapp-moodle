(function (window) {
    const TOKEN_KEY = "ifrn_access_token";
    const DEFAULT_BASE_URL = "";
    const CACHE_TTL_MS = 60 * 1000; // 1 minuto: reduz chamadas repetidas sem ficar desatualizado demais.

    let baseUrl = DEFAULT_BASE_URL;

    // Cache simples para evitar múltiplos fetchs iguais em sequência.
    const dashboardCache = {
        value: null,
        fetchedAt: 0,
        inFlight: null,
    };

    const courseCache = new Map(); // courseId -> { value, fetchedAt, inFlight }

    function setApiBaseUrl(url) {
        baseUrl = typeof url === "string" ? url : DEFAULT_BASE_URL;
    }

    function joinUrl(path) {
        if (!baseUrl) {
            return path;
        }

        // Remove barra no fim e garante barra no começo do path.
        const left = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
        const right = path.startsWith("/") ? path : "/" + path;

        return left + right;
    }

    function getToken() {
        const params = new URLSearchParams(window.location.search);
        const queryToken = params.get("token");

        if (queryToken) {
            sessionStorage.setItem(TOKEN_KEY, queryToken);

            return queryToken;
        }

        return sessionStorage.getItem(TOKEN_KEY);
    }

    function clearToken() {
        sessionStorage.removeItem(TOKEN_KEY);
    }

    function isCacheFresh(fetchedAt) {
        if (!fetchedAt) {
            return false;
        }

        return Date.now() - fetchedAt < CACHE_TTL_MS;
    }

    async function readError(response) {
        try {
            const data = await response.json();
            const message = data && (data.detail || data.message);

            return message || JSON.stringify(data);
        } catch {
            try {
                const text = await response.text();
                return text || response.statusText;
            } catch {
                return response.statusText;
            }
        }
    }

    async function request(path, options) {
        const token = getToken();

        if (!token) {
            throw new Error("Sessão expirada. Entre novamente.");
        }

        const headers = {
            Accept: "application/json",
            Authorization: "Bearer " + token,
        };

        const response = await fetch(joinUrl(path), {
            headers,
            ...(options || {}),
        });

        if (response.status === 401 || response.status === 403) {
            clearToken();
            throw new Error("Sessão expirada. Entre novamente.");
        }

        if (!response.ok) {
            const detail = await readError(response);
            throw new Error(detail || "Não foi possível carregar os dados do painel.");
        }

        return response.json();
    }

    function getDashboard(force) {
        if (!force && dashboardCache.value && isCacheFresh(dashboardCache.fetchedAt)) {
            return Promise.resolve(dashboardCache.value);
        }

        if (dashboardCache.inFlight && !force) {
            return dashboardCache.inFlight;
        }

        dashboardCache.inFlight = request("/dashboard/").then(function (data) {
            dashboardCache.value = data;
            dashboardCache.fetchedAt = Date.now();
            return data;
        }).finally(function () {
            dashboardCache.inFlight = null;
        });

        return dashboardCache.inFlight;
    }

    function getCourse(courseId, force) {
        const id = String(courseId);
        let entry = courseCache.get(id);

        if (!entry) {
            entry = { value: null, fetchedAt: 0, inFlight: null };
            courseCache.set(id, entry);
        }

        if (!force && entry.value && isCacheFresh(entry.fetchedAt)) {
            return Promise.resolve(entry.value);
        }

        if (entry.inFlight && !force) {
            return entry.inFlight;
        }

        entry.inFlight = request("/courses/" + encodeURIComponent(id)).then(function (data) {
            entry.value = data;
            entry.fetchedAt = Date.now();
            return data;
        }).finally(function () {
            entry.inFlight = null;
        });

        return entry.inFlight;
    }

    function invalidateCache() {
        dashboardCache.value = null;
        dashboardCache.fetchedAt = 0;
        dashboardCache.inFlight = null;

        courseCache.clear();
    }

    // Conveniência: extrai os cursos do dashboard sem precisar fazer o app lidar com null.
    async function getCoursesList() {
        const dashboard = await getDashboard(false);
        return (dashboard && dashboard.courses) || [];
    }

    window.MobileMoodleApi = {
        setApiBaseUrl,
        getToken,
        invalidateCache,
        getCoursesList,
        getDashboard,
        getCourse,
    };
})(window);

