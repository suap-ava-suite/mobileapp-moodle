(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const App = (MM.App = MM.App || {});

    App.content = document.getElementById("page-content");
    App.title = document.getElementById("page-title");
    App.menuUserInfo = document.getElementById("menu-user-info");
    App.toolbarAvatar = document.getElementById("toolbar-avatar");
    App.templatesRoot = document.getElementById("page-templates");
    App.dashboardCache = null;

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

    function bindMenu() {
        const logoutBtn = document.getElementById("menu-logout");

        if (logoutBtn) {
            logoutBtn.addEventListener("click", function (event) {
                event.preventDefault();
                logout();
            });
        }
    }

    function resolveApiBase() {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get("api");

        if (fromQuery && /^https?:\/\//i.test(fromQuery)) {
            return fromQuery.replace(/\/+$/, "");
        }

        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(window.location.origin)) {
            return "http://localhost:8000";
        }

        return window.location.origin;
    }

    window.addEventListener("hashchange", function () {
        App.loadRoute(false);
    });

    window.addEventListener("DOMContentLoaded", function () {
        if (window.MobileMoodleApi && window.MobileMoodleApi.setApiBaseUrl) {
            window.MobileMoodleApi.setApiBaseUrl(resolveApiBase());
        }

        bindMenu();

        if (!window.location.hash) {
            window.location.hash = "/painel";

            return;
        }

        App.loadRoute(false);
    });
})(window);
