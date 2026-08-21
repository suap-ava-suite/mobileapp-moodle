(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const TOKEN_KEY = "ifrn_access_token";
    const JWT_SHAPE = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;

    function isValidToken(token) {
        return typeof token === "string" && JWT_SHAPE.test(token) && token.length < 4096;
    }

    function stripTokenFromUrl() {
        try {
            const url = new URL(window.location.href);

            if (!url.searchParams.has("token")) {
                return;
            }

            url.searchParams.delete("token");
            window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        } catch {
            // ignore
        }
    }

    function getToken() {
        const params = new URLSearchParams(window.location.search);
        const queryToken = params.get("token");

        if (queryToken && isValidToken(queryToken)) {
            sessionStorage.setItem(TOKEN_KEY, queryToken);
            stripTokenFromUrl();

            return queryToken;
        }

        if (queryToken) {
            stripTokenFromUrl();
        }

        const stored = sessionStorage.getItem(TOKEN_KEY);

        return isValidToken(stored) ? stored : null;
    }

    function setToken(token) {
        if (!isValidToken(token)) {
            clearToken();

            return false;
        }

        sessionStorage.setItem(TOKEN_KEY, token);

        return true;
    }

    function clearToken() {
        sessionStorage.removeItem(TOKEN_KEY);

        if (typeof MM.invalidateCache === "function") {
            MM.invalidateCache();
        }
    }

    MM.TOKEN_KEY = TOKEN_KEY;
    MM.isValidToken = isValidToken;
    MM.getToken = getToken;
    MM.setToken = setToken;
    MM.clearToken = clearToken;
})(window);
