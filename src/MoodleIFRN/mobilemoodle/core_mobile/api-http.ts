/**
 * api-http.ts
 * Cliente HTTP: fetch com Bearer, timeout e tratamento de erros.
 */
import { MM } from './namespace';

    const DEFAULT_BASE_URL = '';
    const REQUEST_TIMEOUT_MS = 15000;

    let baseUrl = DEFAULT_BASE_URL;

    function isAllowedApiBase(url: string): boolean {
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

    function isSafeApiPath(path: string): boolean {
        return typeof path === 'string' &&
            path.charAt(0) === '/' &&
            path.charAt(1) !== '/' &&
            !/^[a-z][a-z0-9+.-]*:/i.test(path) &&
            path.indexOf('\\') === -1;
    }

    function setApiBaseUrl(url: string): void {
        if (typeof url !== 'string') {
            baseUrl = DEFAULT_BASE_URL;

            return;
        }

        const cleaned = url.trim().replace(/\/+$/, '');

        if (!cleaned || !isAllowedApiBase(cleaned)) {
            baseUrl = DEFAULT_BASE_URL;

            return;
        }

        baseUrl = cleaned;
    }

    function joinUrl(path: string): string {
        if (!isSafeApiPath(path)) {
            throw new MM.ApiError(400, 'Caminho de API inválido.');
        }

        if (!baseUrl) {
            return path;
        }

        return baseUrl + path;
    }

    async function readError(response: Response): Promise<string> {
        try {
            const data = await response.json() as { detail?: string; message?: string } | null;
            const message = data && (data.detail || data.message);

            if (typeof message === 'string') {
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

    async function request(path: string, options?: RequestInit): Promise<unknown> {
        const token = MM.getToken();

        if (!token) {
            throw new MM.ApiError(401);
        }

        if (!isSafeApiPath(path)) {
            throw new MM.ApiError(400, 'Caminho de API inválido.');
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
            controller.abort();
        }, REQUEST_TIMEOUT_MS);

        const headers: HeadersInit = {
            Accept: 'application/json',
            Authorization: 'Bearer ' + token,
        };

        let response: Response;

        try {
            response = await fetch(joinUrl(path), {
                method: (options && options.method) || 'GET',
                headers,
                credentials: 'omit',
                cache: 'no-store',
                signal: controller.signal,
                body: options && options.body,
            });
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new MM.ApiError(408);
            }

            throw new MM.ApiError(0, 'Falha de rede. Confira a conexão e tente novamente.');
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

        const contentType = response.headers.get('content-type') || '';

        if (!contentType.includes('application/json')) {
            throw new MM.ApiError(502, 'Resposta inválida do servidor.');
        }

        return response.json();
    }

    MM.setApiBaseUrl = setApiBaseUrl;
    MM.joinUrl = joinUrl;
    MM.request = request;
