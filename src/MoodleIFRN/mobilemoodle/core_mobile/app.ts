/**
 * app.ts
 * Bootstrap: DOM, menu, base da API e eventos iniciais.
 */
import { initKeyboardInsets } from './app-keyboard';
import { MM, App } from './namespace';


    App.content = document.getElementById('page-content');
    App.title = document.getElementById('page-title');
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

    function resolveApiBase(): string {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(window.location.origin)) {
            return 'http://localhost:8000';
        }

        return window.location.origin;
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

        if (document.querySelector('#page-content .page-loading')) {
            App.markLoadingStart?.();
        }

        const hash = window.location.hash.replace(/^#/, '');

        if (!hash || hash === '/') {
            window.location.hash = '/painel';

            return;
        }

        App.loadRoute?.(false);
    });
