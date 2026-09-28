/*!
 * app-utils.ts
 * ----------------------------------------------------------------------------
 * Utilitários de UI compartilhados pelo App:
 * - descobrir pasta dos assets (logo, pages/*.html)
 * - escapeHtml / iniciais do nome
 * - clonar <template id="tpl-…">
 * - fetchText de partials HTML
 * - URL de volta ao login IFRN
 */
import { MM, App } from './namespace';

    /**
     * Base onde estão pages/, static/, etc.
     * Preferência: pasta do script mobilemoodle.js; fallback: URL atual.
     */
    function resolveAssetBase(): string {
        const scripts = document.getElementsByTagName('script');

        for (let i = scripts.length - 1; i >= 0; i -= 1) {
            const src = scripts[i].src || '';

            if (src.indexOf('/mobilemoodle.js') !== -1) {
                return src.replace(/\/mobilemoodle\.js(?:\?.*)?$/i, '/');
            }
        }

        try {
            return new URL('./', window.location.href).href;
        } catch {
            return '/mobilemoodle/';
        }
    }

    /** Sempre use antes de innerHTML com texto da API. */
    function escapeHtml(value: unknown): string {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** Primeira letra do nome para avatar sem foto. */
    function initials(name: unknown): string {
        const letters = String(name || 'U').trim().charAt(0).toUpperCase();

        return letters || 'U';
    }

    /** Clona o conteúdo de um <template> do index.html / pages/*.html. */
    function cloneTemplate(id: string): DocumentFragment | null {
        const tpl = document.getElementById(id) as HTMLTemplateElement | null;

        if (!tpl) {
            return null;
        }

        return tpl.content.cloneNode(true) as DocumentFragment;
    }

    /** Carrega HTML de partial (painel, curso, erros) com timeout de 10s. */
    async function fetchText(url: string): Promise<string> {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            controller.abort();
        }, 10000);

        try {
            const response = await fetch(url, {
                credentials: 'omit',
                cache: 'no-cache',
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error('Falha ao carregar interface (' + response.status + ').');
            }

            return response.text();
        } finally {
            window.clearTimeout(timer);
        }
    }

    /**
     * URL do app Ionic (PathLocationStrategy).
     * O painel mobilemoodle usa hash (#/painel); o Moodle Mobile/Ionic NÃO —
     * rotas Ionic são path reais: /login/..., não /#/login/...
     */
    function resolveIonicAppUrl(routePath: string): string {
        const path = routePath.startsWith('/') ? routePath : `/${routePath}`;

        try {
            const url = new URL(`..${path}`, App.ASSET_BASE || window.location.href);

            url.hash = '';
            url.search = '';

            return url.toString();
        } catch {
            return path;
        }
    }

    /** Volta um nível (www/) e abre a rota Angular do login IFRN. */
    function resolveLoginUrl(): string {
        return resolveIonicAppUrl('/login/ifrn-login');
    }

    /**
     * Abre a rota Ionic que estabelece sessão Moodle e abre o courseid nativo.
     * courseId/siteUrl/courseName ficam em sessionStorage (mesma origem) para
     * sobreviver ao OAuth / reload — o usuário não precisa clicar de novo.
     *
     * siteUrl deve ser a origem real do viewurl (nunca mock 127.0.0.1:8002).
     */
    function resolveMoodleOpenUrl(courseId: number | string, courseName?: string, siteUrl?: string): string {
        const id = Number(courseId);

        if (Number.isFinite(id) && id > 0) {
            try {
                // eslint-disable-next-line no-console
                console.log('[IFRN-COURSE] courseId recebido do Painel =', id);

                sessionStorage.setItem(
                    'ifrn_moodle_pending_open_course',
                    JSON.stringify({
                        courseId: id,
                        courseName: courseName || undefined,
                        siteUrl: siteUrl || undefined,
                    }),
                );
            } catch {
                // ignore quota
            }
        }

        return resolveIonicAppUrl('/login/moodle-open-course');
    }

    App.ASSET_BASE = resolveAssetBase();
    App.resolveLoginUrl = resolveLoginUrl;
    App.resolveMoodleOpenUrl = resolveMoodleOpenUrl;
    App.escapeHtml = escapeHtml;
    App.initials = initials;
    App.cloneTemplate = cloneTemplate;
    App.fetchText = fetchText;
