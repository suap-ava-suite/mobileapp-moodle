"use strict";
/**
 * app-status.ts
 * Telas de estado: loading, erro e not found.
 */
(function (window) {
    'use strict';
    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const App = (MM.App = MM.App || {});
    const SPLASH_GAUGE_SVG = '<div class="ava-splash__gauge" aria-hidden="true">' +
        '<svg class="ava-splash__gauge-svg" viewBox="0 0 120 120" aria-hidden="true">' +
        '<defs>' +
        '<linearGradient id="ava-splash-gauge-grad" gradientUnits="userSpaceOnUse" x1="60" y1="6" x2="60" y2="114">' +
        '<stop offset="0%" stop-color="#61c924"></stop>' +
        '<stop offset="55%" stop-color="#098e95"></stop>' +
        '<stop offset="100%" stop-color="#0b6064"></stop>' +
        '</linearGradient>' +
        '</defs>' +
        '<circle class="ava-splash__gauge-track" cx="60" cy="60" r="54"></circle>' +
        '<circle class="ava-splash__gauge-arc" cx="60" cy="60" r="54"></circle>' +
        '</svg>' +
        '</div>';
    const LOADING_MIN_MS = 3000;
    let loadingStartedAt = 0;
    function markLoadingStart() {
        if (!loadingStartedAt) {
            loadingStartedAt = Date.now();
        }
    }
    function waitLoadingMinimum(force = false) {
        if (force || !loadingStartedAt) {
            loadingStartedAt = 0;
            return Promise.resolve();
        }
        const remaining = LOADING_MIN_MS - (Date.now() - loadingStartedAt);
        loadingStartedAt = 0;
        if (remaining <= 0) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            window.setTimeout(resolve, remaining);
        });
    }
    function buildSplashBrand(logoSrc) {
        return ('<div class="ava-splash__brand">' +
            SPLASH_GAUGE_SVG +
            '<img class="ava-splash__logo" src="' + logoSrc + '" alt="Painel AVA">' +
            '</div>');
    }
    function showLoading(message) {
        markLoadingStart();
        const logoSrc = (App.ASSET_BASE || '') + 'static/theme/ifrn/img/splash-logo.png';
        if (!App.content) {
            return;
        }
        App.content.innerHTML =
            '<div class="ava-splash page-loading" role="status" aria-live="polite">' +
                buildSplashBrand(logoSrc) +
                '<p class="ava-splash__text">' + App.escapeHtml(message || 'Carregando...') + '</p>' +
                '</div>';
    }
    function bindRetry(button) {
        if (!button) {
            return;
        }
        button.addEventListener('click', () => {
            App.loadRoute?.(true);
        });
    }
    function showErrorFallback(message, canRetry) {
        if (!App.content) {
            return;
        }
        App.content.innerHTML =
            '<div class="page-error">' +
                '<h3>Não foi possível abrir o painel</h3>' +
                '<p>' + App.escapeHtml(message) + '</p>' +
                (canRetry
                    ? '<ion-button id="retry-load" color="primary">Tentar novamente</ion-button>'
                    : '') +
                '</div>';
        bindRetry(document.getElementById('retry-load'));
    }
    function showNotFound() {
        if (App.title) {
            App.title.textContent = 'Não encontrada';
        }
        const page = App.cloneTemplate?.('tpl-not-found');
        if (!page || !App.content) {
            showErrorFallback('O endereço que você tentou abrir não existe ou foi removido.', false);
            return;
        }
        App.content.innerHTML = '';
        App.content.appendChild(page);
    }
    function showStatusError(error) {
        const err = error;
        const status = err && typeof err.status === 'number' ? err.status : 0;
        const message = (err && err.message) || 'Erro inesperado.';
        const errorTitle = (err && err.title) || 'Algo deu errado';
        const canRetry = err && typeof err.retryable === 'boolean'
            ? err.retryable
            : status === 0 || status === 408 || status >= 500;
        if (status === 404) {
            showNotFound();
            return;
        }
        const page = App.cloneTemplate?.('tpl-error-page');
        if (!page || !App.content) {
            showErrorFallback(message, canRetry);
            return;
        }
        if (App.title) {
            App.title.textContent = errorTitle;
        }
        App.content.innerHTML = '';
        App.content.appendChild(page);
        const codeEl = document.getElementById('status-code');
        const titleEl = document.getElementById('status-title');
        const messageEl = document.getElementById('status-message');
        const actionsEl = document.getElementById('status-actions');
        if (codeEl) {
            codeEl.textContent = status > 0 ? String(status) : '!';
        }
        if (titleEl) {
            titleEl.textContent = errorTitle;
        }
        if (messageEl) {
            messageEl.textContent = message;
        }
        if (actionsEl) {
            actionsEl.innerHTML = '';
            if (canRetry) {
                const retry = document.createElement('ion-button');
                retry.id = 'retry-load';
                retry.setAttribute('color', 'primary');
                retry.textContent = 'Tentar novamente';
                actionsEl.appendChild(retry);
                bindRetry(retry);
            }
            if (status === 401 || status === 403) {
                const hint = document.createElement('p');
                hint.className = 'status-page__hint';
                hint.textContent = 'Faça login novamente no aplicativo.';
                actionsEl.appendChild(hint);
            }
            else {
                const home = document.createElement('ion-button');
                home.setAttribute('fill', 'clear');
                home.setAttribute('color', 'primary');
                home.setAttribute('href', '#/painel');
                home.textContent = 'Voltar ao painel';
                actionsEl.appendChild(home);
            }
        }
    }
    App.showLoading = showLoading;
    App.markLoadingStart = markLoadingStart;
    App.waitLoadingMinimum = waitLoadingMinimum;
    App.showNotFound = showNotFound;
    App.showStatusError = showStatusError;
})(window);
