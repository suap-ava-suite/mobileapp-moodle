(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const DEFAULT_BASE_URL = "";
    const REQUEST_TIMEOUT_MS = 15000;

    let baseUrl = DEFAULT_BASE_URL;

    function setApiBaseUrl(url) {
        if (typeof url !== "string") {
            baseUrl = DEFAULT_BASE_URL;

            return;
        }

        baseUrl = url.trim().replace(/\/+$/, "");
    }

    function joinUrl(path) {
        const right = path.startsWith("/") ? path : "/" + path;

        if (!baseUrl) {
            return right;
        }

        return baseUrl + right;
    }

    async function readError(response) {
        try {
            const data = await response.json();
            const message = data && (data.detail || data.message);

            if (typeof message === "string") {
                return message.slice(0, 280);
            }

            return response.statusText;
        } catch {
            try {
                const text = await response.text();

                return (text || response.statusText).slice(0, 280);
            } catch {
                return response.statusText;
            }
        }
    }

    async function request(path, options) {
        const token = MM.getToken();

        if (!token) {
            throw new MM.ApiError(401);
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(function () {
            controller.abort();
        }, REQUEST_TIMEOUT_MS);

        const headers = Object.assign(
            {
                Accept: "application/json",
                Authorization: "Bearer " + token,
            },
            (options && options.headers) || {},
        );

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
                throw new MM.ApiError(408);
            }

            throw new MM.ApiError(0, "Falha de rede. Confira a conexão e tente novamente.");
        } finally {
            window.clearTimeout(timeoutId);
        }

        if (response.status === 401 || response.status === 403) {
            MM.clearToken();
            throw new MM.ApiError(response.status);
        }

        if (!response.ok) {
            const detail = await readError(response);
            throw new MM.ApiError(response.status, detail);
        }

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
