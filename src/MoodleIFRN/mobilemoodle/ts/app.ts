/**
 * app.ts
 * Bootstrap: DOM, menu, base da API e eventos iniciais.
 */
(function (window: Window) {
    'use strict';

    const MM = (window.MobileMoodle = window.MobileMoodle || ({} as MobileMoodleNamespace));
    const App = (MM.App = MM.App || ({} as MobileMoodleApp));

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
        App.showStatusError?.({
            status: 401,
            title: 'Sessão encerrada',
            message: 'Faça login novamente no aplicativo.',
            retryable: false,
        });
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

        if (!window.location.hash) {
            window.location.hash = '/painel';

            return;
        }

        App.loadRoute?.(false);
    });
})(window);
