"use strict";
/**
 * api-auth.ts
 * JWT: ler da URL (?token=), guardar no sessionStorage e limpar.
 */
(function (window) {
    'use strict';
    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const TOKEN_KEY = 'ifrn_access_token';
    const JWT_SHAPE = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;
    function readJwtPayload(token) {
        try {
            const part = token.split('.')[1];
            const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
            const json = window.atob(padded);
            return JSON.parse(json);
        }
        catch {
            return null;
        }
    }
    function isValidToken(token) {
        if (typeof token !== 'string' || !JWT_SHAPE.test(token) || token.length >= 4096) {
            return false;
        }
        const payload = readJwtPayload(token);
        if (!payload || typeof payload !== 'object') {
            return false;
        }
        if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
            return false;
        }
        return true;
    }
    function stripTokenFromUrl() {
        try {
            const url = new URL(window.location.href);
            if (!url.searchParams.has('token')) {
                return;
            }
            url.searchParams.delete('token');
            window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        }
        catch {
            // ignore
        }
    }
    function getToken() {
        const params = new URLSearchParams(window.location.search);
        const queryToken = params.get('token');
        if (queryToken && isValidToken(queryToken)) {
            sessionStorage.setItem(TOKEN_KEY, queryToken);
            stripTokenFromUrl();
            return queryToken;
        }
        if (queryToken) {
            stripTokenFromUrl();
        }
        const stored = sessionStorage.getItem(TOKEN_KEY);
        if (stored && isValidToken(stored)) {
            return stored;
        }
        if (stored) {
            clearToken();
        }
        return null;
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
        if (typeof MM.invalidateCache === 'function') {
            MM.invalidateCache();
        }
    }
    MM.TOKEN_KEY = TOKEN_KEY;
    MM.isValidToken = isValidToken;
    MM.getToken = getToken;
    MM.setToken = setToken;
    MM.clearToken = clearToken;
})(window);
