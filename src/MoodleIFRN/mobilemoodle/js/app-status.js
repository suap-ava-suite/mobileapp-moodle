/**
 * app-status.js
 * Telas de estado: loading, erro (500/502/503…), notfound e fallback simples.
 */
(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const App = (MM.App = MM.App || {});

    /** Spinner + mensagem enquanto carrega painel/curso. */
    function showLoading(message) {
        App.content.innerHTML =
            '<div class="page-loading">' +
                '<ion-spinner name="crescent" color="primary"></ion-spinner>' +
                "<p>" + App.escapeHtml(message || "Carregando...") + "</p>" +
            "</div>";
    }

    /** Liga o botão "Tentar novamente" à recarga forçada da rota. */
    function bindRetry(button) {
        if (!button) {
            return;
        }

        button.addEventListener("click", function () {
            App.loadRoute(true);
        });
    }

    /**
     * Fallback se o template de erro (pages/erros.html) não carregou.
     * Mostra um bloco simples com a mensagem.
     */
    function showErrorFallback(message, canRetry) {
        App.content.innerHTML =
            '<div class="page-error">' +
                "<h3>Não foi possível abrir o painel</h3>" +
                "<p>" + App.escapeHtml(message) + "</p>" +
                (canRetry
                    ? '<ion-button id="retry-load" color="primary">Tentar novamente</ion-button>'
                    : "") +
            "</div>";

        bindRetry(document.getElementById("retry-load"));
    }

    /** Página 404 (rota inválida ou recurso inexistente). */
    function showNotFound() {
        App.title.textContent = "Não encontrada";

        const page = App.cloneTemplate("tpl-not-found");

        if (!page) {
            showErrorFallback("O endereço que você tentou abrir não existe ou foi removido.", false);

            return;
        }

        App.content.innerHTML = "";
        App.content.appendChild(page);
    }

    /**
     * Monta a tela de erro a partir de um ApiError (ou objeto parecido).
     * Espera: { status, title, message, retryable }.
     */
    function showStatusError(error) {
        const status = error && typeof error.status === "number" ? error.status : 0;
        const message = (error && error.message) || "Erro inesperado.";
        const errorTitle = (error && error.title) || "Algo deu errado";
        const canRetry = error && typeof error.retryable === "boolean"
            ? error.retryable
            : status === 0 || status === 408 || status >= 500;

        // 404 da API usa a mesma tela de "página não encontrada".
        if (status === 404) {
            showNotFound();

            return;
        }

        const page = App.cloneTemplate("tpl-error-page");

        if (!page) {
            showErrorFallback(message, canRetry);

            return;
        }

        App.title.textContent = errorTitle;
        App.content.innerHTML = "";
        App.content.appendChild(page);

        // Preenche os elementos do template.
        const codeEl = document.getElementById("status-code");
        const titleEl = document.getElementById("status-title");
        const messageEl = document.getElementById("status-message");
        const actionsEl = document.getElementById("status-actions");

        if (codeEl) {
            codeEl.textContent = status > 0 ? String(status) : "!";
        }

        if (titleEl) {
            titleEl.textContent = errorTitle;
        }

        if (messageEl) {
            messageEl.textContent = message;
        }

        if (actionsEl) {
            actionsEl.innerHTML = "";

            // Botão de retry quando o erro costuma ser temporário (5xx, rede…).
            if (canRetry) {
                const retry = document.createElement("ion-button");

                retry.id = "retry-load";
                retry.setAttribute("color", "primary");
                retry.textContent = "Tentar novamente";
                actionsEl.appendChild(retry);
                bindRetry(retry);
            }

            if (status === 401 || status === 403) {
                // Sem sessão: só orienta a logar de novo.
                const hint = document.createElement("p");

                hint.className = "status-page__hint";
                hint.textContent = "Faça login novamente no aplicativo.";
                actionsEl.appendChild(hint);
            } else {
                // Nos demais erros, oferece voltar ao painel.
                const home = document.createElement("ion-button");

                home.setAttribute("fill", "clear");
                home.setAttribute("color", "primary");
                home.setAttribute("href", "#/painel");
                home.textContent = "Voltar ao painel";
                actionsEl.appendChild(home);
            }
        }
    }

    App.showLoading = showLoading;
    App.showNotFound = showNotFound;
    App.showStatusError = showStatusError;
})(window);
