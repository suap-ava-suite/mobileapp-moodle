"use strict";
/**
 * app-router.ts
 * Roteamento por hash e orquestração do carregamento das telas.
 */
(function (window) {
    'use strict';
    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const App = (MM.App = MM.App || {});
    let templatesReady = null;
    let routeSeq = 0;
    function parseRoute() {
        const hash = window.location.hash.replace(/^#/, '') || '/painel';
        const courseMatch = hash.match(/^\/curso\/(\d{1,10})$/);
        if (courseMatch) {
            return { name: 'curso', courseId: Number(courseMatch[1]) };
        }
        if (hash === '/painel' || hash === '/' || hash === '') {
            return { name: 'painel' };
        }
        return { name: 'notfound' };
    }
    async function loadTemplates() {
        if (templatesReady) {
            return templatesReady;
        }
        if (document.getElementById('tpl-painel') &&
            document.getElementById('tpl-curso') &&
            document.getElementById('tpl-error-page')) {
            templatesReady = Promise.resolve();
            return templatesReady;
        }
        const assetBase = App.ASSET_BASE || '';
        const base = assetBase.indexOf('static/theme/ifrn/') !== -1
            ? assetBase.replace(/static\/theme\/ifrn\/$/, '')
            : assetBase;
        templatesReady = Promise.all([
            App.fetchText(base + 'pages/painel.html'),
            App.fetchText(base + 'pages/curso.html'),
            App.fetchText(base + 'pages/erros.html'),
        ]).then((parts) => {
            if (App.templatesRoot) {
                App.templatesRoot.innerHTML = parts.join('\n');
            }
        }).catch((error) => {
            templatesReady = null;
            throw error;
        });
        return templatesReady;
    }
    async function loadDashboard(force) {
        if (!force && App.dashboardCache) {
            return App.dashboardCache;
        }
        App.dashboardCache = await window.MobileMoodleApi.getDashboard(force);
        return App.dashboardCache;
    }
    async function loadRoute(force) {
        const seq = ++routeSeq;
        const route = parseRoute();
        try {
            await loadTemplates();
            if (seq !== routeSeq) {
                return;
            }
            if (route.name === 'notfound') {
                App.showNotFound?.();
                return;
            }
            if (!window.MobileMoodleApi.getToken()) {
                App.showStatusError?.({
                    status: 401,
                    title: 'Acesso não autorizado',
                    message: 'Token de acesso não encontrado. Faça login no aplicativo.',
                    retryable: false,
                });
                return;
            }
            App.showLoading?.(route.name === 'curso' ? 'Carregando curso...' : 'Carregando painel...');
            if (route.name === 'curso') {
                const [dashboard, course] = await Promise.all([
                    loadDashboard(force),
                    window.MobileMoodleApi.getCourse(route.courseId, force),
                    App.waitLoadingMinimum?.(force) ?? Promise.resolve(),
                ]);
                if (seq !== routeSeq) {
                    return;
                }
                App.renderCurso?.(course, dashboard);
                return;
            }
            if (force) {
                App.dashboardCache = null;
                window.MobileMoodleApi.invalidateCache();
            }
            const [dashboard] = await Promise.all([
                loadDashboard(force),
                App.waitLoadingMinimum?.(force) ?? Promise.resolve(),
            ]);
            if (seq !== routeSeq) {
                return;
            }
            App.renderPainel?.(dashboard);
        }
        catch (error) {
            if (seq !== routeSeq) {
                return;
            }
            App.showStatusError?.(error);
        }
    }
    App.parseRoute = parseRoute;
    App.loadRoute = loadRoute;
})(window);
