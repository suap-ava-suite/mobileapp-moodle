/**
 * api-http.js
 * Cliente HTTP: monta a URL da API, faz fetch com Bearer e timeout,
 * e transforma respostas de erro em ApiError.
 */
(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const DEFAULT_BASE_URL = "";
    const REQUEST_TIMEOUT_MS = 15000; // 15s — aborta se a API não responder

    let baseUrl = DEFAULT_BASE_URL;

    /** Só aceita mesma origem ou localhost de desenvolvimento. */
    function isAllowedApiBase(url) {
        try {
            const parsed = new URL(url);
            const origin = window.location.origin;

            if (parsed.origin === origin) {
                return true;
            }

            return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(parsed.origin);
        } catch {
            return false;
        }
    }

    /** Path relativo seguro (bloqueia //host, http:, javascript:, etc.). */
    function isSafeApiPath(path) {
        return typeof path === "string" &&
            path.charAt(0) === "/" &&
            path.charAt(1) !== "/" &&
            !/^[a-z][a-z0-9+.-]*:/i.test(path) &&
            path.indexOf("\\") === -1;
    }

    /** Define a origem da API (ex.: http://localhost:8000). */
    function setApiBaseUrl(url) {
        if (typeof url !== "string") {
            baseUrl = DEFAULT_BASE_URL;

            return;
        }

        const cleaned = url.trim().replace(/\/+$/, "");

        if (!cleaned || !isAllowedApiBase(cleaned)) {
            baseUrl = DEFAULT_BASE_URL;

            return;
        }

        baseUrl = cleaned;
    }

    /** Junta base + path (ex.: http://localhost:8000 + /dashboard/). */
    function joinUrl(path) {
        if (!isSafeApiPath(path)) {
            throw new MM.ApiError(400, "Caminho de API inválido.");
        }

        if (!baseUrl) {
            return path;
        }

        return baseUrl + path;
    }

    /** Tenta extrair message/detail do JSON de erro da API. */
    async function readError(response) {
        try {
            const data = await response.json();
            const message = data && (data.detail || data.message);

            if (typeof message === "string") {
                return message.slice(0, 280); // limita tamanho na UI
            }

            return response.statusText;
        } catch {
            // Corpo não era JSON — tenta texto puro.
            try {
                const text = await response.text();

                return (text || response.statusText).slice(0, 280);
            } catch {
                return response.statusText;
            }
        }
    }

    /**
     * Requisição autenticada genérica.
     * Usada por getDashboard / getCourse em api.js.
     */
    async function request(path, options) {
        const token = MM.getToken();

        if (!token) {
            throw new MM.ApiError(401);
        }

        if (!isSafeApiPath(path)) {
            throw new MM.ApiError(400, "Caminho de API inválido.");
        }

        // Timeout via AbortController (padrão do fetch).
        const controller = new AbortController();
        const timeoutId = window.setTimeout(function () {
            controller.abort();
        }, REQUEST_TIMEOUT_MS);

        // Headers fechados: evita sobrescrever Authorization por options.headers.
        const headers = {
            Accept: "application/json",
            Authorization: "Bearer " + token,
        };

        let response;

        try {
            response = await fetch(joinUrl(path), {
                method: (options && options.method) || "GET",
                headers: headers,
                credentials: "omit",
                cache: "no-store",
                signal: controller.signal,
                body: options && options.body,
            });
        } catch (error) {
            if (error && error.name === "AbortError") {
                throw new MM.ApiError(408); // timeout
            }

            // Sem rede, CORS, servidor offline, etc.
            throw new MM.ApiError(0, "Falha de rede. Confira a conexão e tente novamente.");
        } finally {
            window.clearTimeout(timeoutId);
        }

        // Sessão inválida → limpa token e avisa a UI.
        if (response.status === 401 || response.status === 403) {
            MM.clearToken();
            throw new MM.ApiError(response.status);
        }

        if (!response.ok) {
            const detail = await readError(response);
            throw new MM.ApiError(response.status, detail);
        }

        // Esperamos sempre JSON desta API.
        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            throw new MM.ApiError(502, "Resposta inválida do servidor.");
        }

        return response.json();
    }

    MM.setApiBaseUrl = setApiBaseUrl;
    MM.joinUrl = joinUrl;
    MM.request = request;
})(window);
