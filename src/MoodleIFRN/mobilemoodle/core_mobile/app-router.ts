/*!
 * app-router.ts
 * ----------------------------------------------------------------------------
 * Roteamento por hash (SPA leve, sem Angular Router).
 *
 * Rotas:
 *   #/painel          → lista de diários / autoinscrição
 *   #/curso/123       → detalhe do curso
 *   qualquer outra    → not found
 *
 * loadRoute():
 *   1. Garante templates HTML carregados
 *   2. Verifica a sessão do Painel AVA
 *   3. Mostra splash → busca API → renderPainel / renderCurso
 *
 * routeSeq evita race: se o usuário mudar o hash no meio do await,
 * a resposta antiga é ignorada.
 */

import { MM, App } from './namespace';

let templatesReady: Promise<void> | null = null;

/** Contador monotônico; cada loadRoute captura seu próprio seq. */
let routeSeq = 0;

function parseRoute(): RouteInfo {
    const hash = window.location.hash.replace(/^#/, '') || '/painel';
    const courseMatch = hash.match(/^\/curso\/(\d{1,10})$/);

    if (courseMatch) {
        return {
            name: 'curso',
            courseId: Number(courseMatch[1]),
        };
    }

    if (hash === '/painel' || hash === '/' || hash === '') {
        return { name: 'painel' };
    }

    return { name: 'notfound' };
}

/**
 * Injeta pages/painel.html, curso.html e erros.html em #page-templates
 * (só uma vez; templatesReady memoiza a Promise).
 */
async function loadTemplates(): Promise<void> {
    if (templatesReady) {
        return templatesReady;
    }

    // Já estão no DOM (ex.: build que embute os partials).
    if (
        document.getElementById('tpl-painel') &&
        document.getElementById('tpl-curso') &&
        document.getElementById('tpl-error-page')
    ) {
        templatesReady = Promise.resolve();

        return templatesReady;
    }

    const assetBase = App.ASSET_BASE || '';

    const base = assetBase.indexOf('static/theme/ifrn/') !== -1
        ? assetBase.replace(/static\/theme\/ifrn\/$/, '')
        : assetBase;

    templatesReady = Promise.all([
        App.fetchText!(base + 'pages/painel.html'),
        App.fetchText!(base + 'pages/curso.html'),
        App.fetchText!(base + 'pages/erros.html'),
    ])
        .then((parts) => {
            if (App.templatesRoot) {
                App.templatesRoot.innerHTML = parts.join('\n');
            }
        })
        .catch((error: unknown) => {
            templatesReady = null;
            throw error;
        });

    return templatesReady;
}

async function loadDashboard(force: boolean): Promise<DashboardData> {
    if (!force && App.dashboardCache) {
        return App.dashboardCache;
    }

    App.dashboardCache =
        await window.MobileMoodleApi.getDashboard(force);

    return App.dashboardCache;
}

/**
 * @param force true = invalidate + refetch (refresh / retry).
 */
async function loadRoute(force: boolean): Promise<void> {
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

        /*
         * O fluxo atual não depende mais do JWT antigo retornado por getToken().
         *
         * A autenticação acontece pelo SUAP/Painel AVA e os dados necessários
         * são armazenados na sessão do Painel.
         */
       const hasPainelSession =
    typeof MM.hasPainelSession === 'function' &&
    MM.hasPainelSession();
        if (!hasPainelSession) {
            console.warn(
                '[IFRN-ROUTER] Sessão do Painel AVA não encontrada.',
            );

            App.showStatusError?.({
                status: 401,
                title: 'Acesso não autorizado',
                message:
                    'A sessão do Painel AVA não foi encontrada. Entre novamente pelo SUAP.',
                retryable: false,
            });

            return;
        }

        console.debug(
            '[IFRN-ROUTER] Sessão do Painel AVA válida.',
            { route: route.name },
        );

        App.showLoading?.(
            route.name === 'curso'
                ? 'Carregando curso...'
                : 'Carregando painel...',
        );

        if (route.name === 'curso') {
            /*
             * Dashboard primeiro:
             * define se o ID é courseid Moodle (Painel)
             * ou diário SUAP.
             */
            const dashboard = await loadDashboard(force);

            const [course] = await Promise.all([
                window.MobileMoodleApi.getCourse(
                    route.courseId,
                    force,
                ),
                App.waitLoadingMinimum?.(force) ??
                    Promise.resolve(),
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
            App.waitLoadingMinimum?.(force) ??
                Promise.resolve(),
        ]);

        if (seq !== routeSeq) {
            return;
        }

        App.renderPainel?.(dashboard);
    } catch (error) {
        if (seq !== routeSeq) {
            return;
        }

        console.error(
            '[IFRN-ROUTER] Erro ao carregar rota.',
            error,
        );

        App.showStatusError?.(error);
    }
}

App.parseRoute = parseRoute;
App.loadRoute = loadRoute;
