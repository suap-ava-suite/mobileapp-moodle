/**
 * app.js
 * Bootstrap da aplicação: liga o DOM, menu, base da API e eventos iniciais.
 * Deve ser o último script da lista (usa App.* definido nos arquivos anteriores).
 */
(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const App = (MM.App = MM.App || {});

    // Referências aos elementos principais do index.html.
    App.content = document.getElementById("page-content");
    App.title = document.getElementById("page-title");
    App.menuUserInfo = document.getElementById("sidebar-user-name");
    App.toolbarAvatar = document.getElementById("toolbar-avatar");
    App.templatesRoot = document.getElementById("page-templates");
    App.dashboardCache = null; // cache local da UI

    /** Sai da sessão e mostra tela de "faça login de novo". */
    function logout() {
        if (window.MobileMoodleApi && window.MobileMoodleApi.clearToken) {
            window.MobileMoodleApi.clearToken();
        }

        App.dashboardCache = null;
        App.showStatusError({
            status: 401,
            title: "Sessão encerrada",
            message: "Faça login novamente no aplicativo.",
            retryable: false,
        });
    }

    App.logout = logout;

    /** Liga sidebar AVA (perfil, ajuda, acessibilidade, filtros). */
    function bindMenu() {
        if (typeof App.bindSidebar === "function") {
            App.bindSidebar();
        }
    }

    /**
     * Decide a URL base da API (lista fechada — evita ?api= redirecionar o token).
     * 1) localhost → http://localhost:8000 (FastAPI de desenvolvimento)
     * 2) senão → mesma origem da página
     */
    function resolveApiBase() {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(window.location.origin)) {
            return "http://localhost:8000";
        }

        return window.location.origin;
    }

    // Troca de hash (#/painel ↔ #/curso/1) → recarrega a rota.
    window.addEventListener("hashchange", function () {
        App.loadRoute(false);
    });

    // Arranque: configura API, menu e primeira rota.
    window.addEventListener("DOMContentLoaded", function () {
        if (window.MobileMoodleApi && window.MobileMoodleApi.setApiBaseUrl) {
            window.MobileMoodleApi.setApiBaseUrl(resolveApiBase());
        }

        bindMenu();

        // Sem hash → define painel (o hashchange dispara loadRoute).
        if (!window.location.hash) {
            window.location.hash = "/painel";

            return;
        }

        App.loadRoute(false);
    });
})(window);
