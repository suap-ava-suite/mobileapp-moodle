/**
 * app-utils.ts
 * Base de assets, escape HTML, templates e fetch de partials.
 */
import { MM, App } from './namespace';


    function resolveAssetBase(): string {
        const scripts = document.getElementsByTagName('script');

        for (let i = scripts.length - 1; i >= 0; i -= 1) {
            const src = scripts[i].src || '';

            if (src.indexOf('/dist/') !== -1) {
                return src.replace(/\/dist\/[^/?#]+(?:\?.*)?$/i, '/');
            }
        }

        try {
            return new URL('./', window.location.href).href;
        } catch {
            return '/mobilemoodle/';
        }
    }

    function escapeHtml(value: unknown): string {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function initials(name: unknown): string {
        const letters = String(name || 'U').trim().charAt(0).toUpperCase();

        return letters || 'U';
    }

    function cloneTemplate(id: string): DocumentFragment | null {
        const tpl = document.getElementById(id) as HTMLTemplateElement | null;

        if (!tpl) {
            return null;
        }

        return tpl.content.cloneNode(true) as DocumentFragment;
    }

    async function fetchText(url: string): Promise<string> {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            controller.abort();
        }, 10000);

        try {
            const response = await fetch(url, {
                credentials: 'omit',
                cache: 'force-cache',
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

    App.ASSET_BASE = resolveAssetBase();
    App.escapeHtml = escapeHtml;
    App.initials = initials;
    App.cloneTemplate = cloneTemplate;
    App.fetchText = fetchText;
