/**
 * api-auth.ts
 * ----------------------------------------------------------------------------
 * Sessão JWT do painel.
 *
 * Fluxo típico após o login IFRN:
 *   1. App abre mobilemoodle/index.html (token pode vir em ?token= uma vez)
 *   2. getToken() valida, salva em sessionStorage e remove o token da URL
 *   3. Demais requests usam Authorization: Bearer …
 *
 * Segurança: formato JWT, tamanho máximo, exp se existir; token inválido é apagado.
 */
import { MM } from './namespace';

    /** Chave única no sessionStorage (só nesta aba / origem). */
    const TOKEN_KEY = 'ifrn_access_token';

    /** Formato mínimo header.payload.signature (base64url). */
    const JWT_SHAPE = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;

    interface JwtPayload {
        exp?: number;
        [key: string]: unknown;
    }

    /** Decodifica o payload do JWT (sem verificar assinatura — isso é do backend). */
    function readJwtPayload(token: string): JwtPayload | null {
        try {
            const part = token.split('.')[1];
            const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
            const json = window.atob(padded);

            return JSON.parse(json) as JwtPayload;
        } catch {
            return null;
        }
    }

    /** Aceita só JWT bem formado e ainda não expirado (se tiver `exp`). */
    function isValidToken(token: string): boolean {
        if (typeof token !== 'string' || !JWT_SHAPE.test(token) || token.length >= 4096) {
            return false;
        }

        const payload = readJwtPayload(token);

        if (!payload || typeof payload !== 'object') {
            return false;
        }

        // exp vem em segundos Unix
        if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
            return false;
        }

        return true;
    }

    /** Evita deixar o JWT visível na barra de endereço / histórico. */
    function stripTokenFromUrl(): void {
        try {
            const url = new URL(window.location.href);

            if (!url.searchParams.has('token')) {
                return;
            }

            url.searchParams.delete('token');
            window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        } catch {
            // ignore
        }
    }

    /**
     * Ordem: query (?token=) → sessionStorage.
     * Query válida é persistida e depois removida da URL.
     */
    function getToken(): string | null {
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

    function setToken(token: string): boolean {
        if (!isValidToken(token)) {
            clearToken();

            return false;
        }

        sessionStorage.setItem(TOKEN_KEY, token);

        return true;
    }

    /** Logout / 401: apaga token e zera caches da API. */
    function clearToken(): void {
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
