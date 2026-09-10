/**
 * app.ts
 * ----------------------------------------------------------------------------
 * Bootstrap do painel (roda por último na ordem de imports).
 *
 * No DOMContentLoaded:
 *   1. Safe-area / teclado (app-keyboard)
 *   2. Base URL da API
 *   3. Preferências de acessibilidade
 *   4. Sidebar
 *   5. loadRoute() conforme o hash (#/painel, #/curso/…)
 *
 * hashchange → navega sem recarregar a página.
 */
import { initKeyboardInsets } from './app-keyboard';
import { MM, App } from './namespace';


    // Referências DOM usadas por views / sidebar / status
    App.content = document.getElementById('page-content');
    App.title = document.getElementById('page-title');
    App.subtitle = document.getElementById('page-subtitle');
    App.menuUserInfo = document.getElementById('sidebar-user-name');
    App.toolbarAvatar = document.getElementById('toolbar-avatar');
    App.templatesRoot = document.getElementById('page-templates');
    App.dashboardCache = null;

    function logout(): void {
        if (window.MobileMoodleApi?.clearToken) {
            window.MobileMoodleApi.clearToken();
        }

        App.dashboardCache = null;

        const loginUrl = typeof App.resolveLoginUrl === 'function'
            ? App.resolveLoginUrl()
            : '/#/login/ifrn-login';

        window.location.replace(loginUrl);
    }

    App.logout = logout;

    function bindMenu(): void {
        if (typeof App.bindSidebar === 'function') {
            App.bindSidebar();
        }
    }

    /**
     * Base da API do painel: SUAP oficial (mesmo JWT do login).
     * Docs: https://suap.ifrn.edu.br/api/docs/
     */
    function resolveApiBase(): string {
        return 'https://suap.ifrn.edu.br';
    }

    window.addEventListener('hashchange', () => {
        App.loadRoute?.(false);
    });

    window.addEventListener('DOMContentLoaded', () => {
        initKeyboardInsets();

        if (window.MobileMoodleApi?.setApiBaseUrl) {
            window.MobileMoodleApi.setApiBaseUrl(resolveApiBase());
        }

        if (App.A11y?.init) {
            App.A11y.init();
        }

        bindMenu();

        // Splash já está no HTML: inicia o timer mínimo de loading
        if (document.querySelector('#page-content .page-loading')) {
            App.markLoadingStart?.();
        }

        const hash = window.location.hash.replace(/^#/, '');

        // Hash vazio → manda para o painel (dispara hashchange → loadRoute)
        if (!hash || hash === '/') {
            window.location.hash = '/painel';

            return;
        }

        App.loadRoute?.(false);
    });
