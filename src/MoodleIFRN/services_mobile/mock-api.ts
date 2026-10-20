import { backendConfig } from './backend.config';
export interface MockProfile { username: string; nome: string }
export interface MockTokens { access_token: string; refresh_token: string; token_type: string }
export interface MockActivity { id: number; section_id: number; course_id: number; name: string; description: string; modname: string }
export interface MockSection { id: number; course_id: number; name: string; activities: MockActivity[] }
export interface MockCourse { id: number; name: string; source: 'mock'; environment: string; summary?: string; sections?: MockSection[] }
export interface MockDashboard {
    source: 'mock'; user: MockProfile; courses: MockCourse[]; diarios: MockCourse[];
    coordenacoes: MockCourse[]; praticas: MockCourse[]; reutilizaveis: MockCourse[]; autoinscricoes: MockCourse[];
}
const KEY = 'ifrn.mock.v1.session';
/** Own origin, tokens and storage. Never imports official auth or API clients. */
export class MockApi {
    private tokens?: MockTokens;
    private refreshPending?: Promise<void>;
    constructor() {
        try { this.tokens = JSON.parse(sessionStorage.getItem(KEY) || 'null') || undefined; } catch { /* invalid session */ }
    }
    get authenticated(): boolean { return !!this.tokens; }
    private async request<T>(path: string, body?: unknown, token?: string): Promise<T> {
        if (backendConfig.provider !== 'mock') throw new Error('Simulação desativada nesta compilação.');
        const base = new URL(backendConfig.baseUrl);
        if (!['127.0.0.1', 'localhost', '10.0.2.2'].includes(base.hostname) || base.port !== '8000') {
            throw new Error('A simulação exige servidor local na porta 8000.');
        }
        const target = new URL(path, base);
        if (target.origin !== base.origin || target.username || target.password || target.search || target.hash
            || base.username || base.password) throw new Error('Destino de simulação inválido.');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const started = Date.now();
        let status = 0;
        try {
            const response = await fetch(target, {
                method: body === undefined ? 'GET' : 'POST', credentials: 'omit', redirect: 'error',
                headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
                    ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
            });
            status = response.status;
            if (!response.ok) throw Object.assign(new Error(`Falha no simulador (HTTP ${status}).`), { status });
            if (status === 204) return undefined as T;
            if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Resposta JSON esperada.');
            return await response.json() as T;
        } finally {
            clearTimeout(timer);
            console.info('[IFRN-MOCK]', { stage: 'request', host: base.host, path: target.pathname, status, duration: Date.now() - started,
                category: status >= 400 ? 'http' : status ? 'response' : 'network-or-cancel' });
        }
    }
    async login(username: string, password: string): Promise<void> {
        this.clear();
        this.tokens = await this.request<MockTokens>('/auth/login', { username, password });
        sessionStorage.setItem(KEY, JSON.stringify(this.tokens));
        sessionStorage.setItem('ifrn.mock.v1.owner', username.trim().toLowerCase());
    }
    async refresh(): Promise<void> {
        if (!this.refreshPending) this.refreshPending = (async () => {
            try {
                if (!this.tokens) throw new Error('Entre na simulação novamente.');
                this.tokens = await this.request<MockTokens>('/auth/refresh', { refresh_token: this.tokens.refresh_token });
                sessionStorage.setItem(KEY, JSON.stringify(this.tokens));
            } catch (error) { this.clear(); throw error; }
            finally { this.refreshPending = undefined; }
        })();
        return this.refreshPending;
    }
    async get<T>(path: string): Promise<T> {
        if (!this.tokens) throw new Error('Entre na simulação novamente.');
        try { return await this.request<T>(path, undefined, this.tokens.access_token); }
        catch (error) {
            if ((error as { status?: number }).status !== 401) throw error;
            await this.refresh();
            return this.request<T>(path, undefined, this.tokens!.access_token);
        }
    }
    async logout(): Promise<void> {
        try { if (this.tokens) await this.request('/auth/logout', {}, this.tokens.access_token); }
        finally { this.clear(); }
    }
    clear(): void {
        this.tokens = undefined;
        sessionStorage.removeItem(KEY);
        sessionStorage.removeItem('ifrn.mock.v1.owner');
    }
}
export const mockApi = new MockApi();
export const courseKey = (source: string, environment: string, id: string | number): string =>
    JSON.stringify([source, environment, String(id)]);
