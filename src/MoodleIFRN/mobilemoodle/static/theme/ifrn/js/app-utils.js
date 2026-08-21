/**
 * app-utils.js
 * Funções auxiliares da UI: base de assets, escape HTML, templates, fetch de partials.
 */
(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const App = (MM.App = MM.App || {});

    /**
     * Descobre a pasta raiz do mobilemoodle a partir da URL do script.
     * Ex.: .../mobilemoodle/js/app-utils.js → .../mobilemoodle/
     */
    function resolveAssetBase() {
        const scripts = document.getElementsByTagName("script");

        for (let i = scripts.length - 1; i >= 0; i -= 1) {
            const src = scripts[i].src || "";

            if (src.indexOf("/js/") !== -1) {
                return src.replace(/\/js\/[^/?#]+(?:\?.*)?$/i, "/");
            }
        }

        try {
            return new URL("./", window.location.href).href;
        } catch {
            return "/mobilemoodle/";
        }
    }

    /** Evita XSS ao inserir texto do usuário/API no HTML. */
    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /** Primeira letra do nome para avatar. */
    function initials(name) {
        const letters = String(name || "U").trim().charAt(0).toUpperCase();

        return letters || "U";
    }

    /**
     * Clona um <template id="..."> do DOM.
     * Os templates vêm de pages/painel.html, curso.html e erros.html.
     */
    function cloneTemplate(id) {
        const tpl = document.getElementById(id);

        if (!tpl) {
            return null;
        }

        return tpl.content.cloneNode(true);
    }

    /** Baixa um arquivo de texto (partial HTML) com timeout curto. */
    async function fetchText(url) {
        const controller = new AbortController();
        const timer = window.setTimeout(function () {
            controller.abort();
        }, 10000);

        try {
            const response = await fetch(url, {
                credentials: "omit",
                cache: "force-cache",
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error("Falha ao carregar interface (" + response.status + ").");
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
})(window);
