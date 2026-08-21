/**
 * api-auth.js
 * Cuida do JWT: ler da URL (?token=), guardar no sessionStorage e limpar.
 */
(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});

    // Chave usada no sessionStorage (mesmo nome do AuthService Angular).
    const TOKEN_KEY = "ifrn_access_token";

    // Formato básico de JWT: três partes separadas por ponto.
    const JWT_SHAPE = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;

    /** Valida formato e tamanho do token antes de aceitar. */
    function isValidToken(token) {
        return typeof token === "string" && JWT_SHAPE.test(token) && token.length < 4096;
    }

    /**
     * Remove ?token= da barra de endereço depois de salvar no sessionStorage
     * (evita deixar o JWT visível no histórico / screenshots).
     */
    function stripTokenFromUrl() {
        try {
            const url = new URL(window.location.href);

            if (!url.searchParams.has("token")) {
                return;
            }

            url.searchParams.delete("token");
            window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        } catch {
            // ignore — URL inválida em ambientes raros
        }
    }

    /**
     * Ordem de leitura:
     * 1) ?token= na URL (vindo do login)
     * 2) sessionStorage (já logado nesta aba)
     */
    function getToken() {
        const params = new URLSearchParams(window.location.search);
        const queryToken = params.get("token");

        // Token válido na URL → salva e limpa a query.
        if (queryToken && isValidToken(queryToken)) {
            sessionStorage.setItem(TOKEN_KEY, queryToken);
            stripTokenFromUrl();

            return queryToken;
        }

        // Token inválido na URL → só limpa a query.
        if (queryToken) {
            stripTokenFromUrl();
        }

        const stored = sessionStorage.getItem(TOKEN_KEY);

        return isValidToken(stored) ? stored : null;
    }

    /** Salva o token; se for inválido, limpa a sessão. */
    function setToken(token) {
        if (!isValidToken(token)) {
            clearToken();

            return false;
        }

        sessionStorage.setItem(TOKEN_KEY, token);

        return true;
    }

    /** Remove o token e invalida o cache da API (se já existir). */
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
