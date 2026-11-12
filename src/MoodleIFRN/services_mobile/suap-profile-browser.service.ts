/* eslint-disable header/header */
import { inject, Injectable, NgZone } from '@angular/core';
import { CoreOpener } from '@static/opener';
import { GovBrBrowserService, isGovBrAuthorizationUrl } from './govbr-browser.service';
import { PainelAvaService } from './painel-ava.service';

export const SUAP_PROFILE_URL = 'https://suap.ifrn.edu.br/comum/minha_conta/';

export interface InternalBrowserPage {
    title: string;
    url: string;
    allowedHosts: readonly string[];
    /** URLs exatas, usadas somente para redirecionadores conhecidos como links curtos. */
    allowedUrls?: readonly string[];
}

export const SUAP_PROFILE_PAGE: InternalBrowserPage = {
    title: 'Perfil SUAP',
    url: SUAP_PROFILE_URL,
    allowedHosts: ['suap.ifrn.edu.br'],
};

export interface SuapProfileBrowserHandlers {
    onReady: () => void;
    onError: (message: string) => void;
    onExit: () => void;
}

interface BrowserSubscription {
    unsubscribe: () => void;
}

type SuapProfileBrowser = ReturnType<typeof CoreOpener.openInApp>;

interface BrowserAttempt {
    id: number;
    page: InternalBrowserPage;
    browser?: SuapProfileBrowser;
    handlers: SuapProfileBrowserHandlers;
    subscriptions: BrowserSubscription[];
    shown: boolean;
    terminal: boolean;
    govRedirect?: string;
    releaseBrowserLease?: () => void;
}

/**
 * Aceita somente navegações HTTPS do host oficial do SUAP.
 *
 * @param candidate URL que será verificada antes da navegação.
 * @returns Se o destino pertence ao host oficial do SUAP.
 */
export function isAllowedSuapProfileNavigation(candidate: string): boolean {
    return isAllowedInternalBrowserNavigation(candidate, SUAP_PROFILE_PAGE);
}

/**
 * Valida HTTPS somente para hosts ou URLs exatas configuradas pelo aplicativo.
 *
 * @param candidate URL recebida do InAppBrowser.
 * @param page Configuração local da página aberta.
 * @returns Se o destino está autorizado pela configuração local.
 */
export function isAllowedInternalBrowserNavigation(candidate: string, page: InternalBrowserPage): boolean {
    if (typeof candidate !== 'string' || !candidate || candidate.length > 8192 || candidate !== candidate.trim()) {
        return false;
    }

    for (let index = 0; index < candidate.length; index++) {
        const code = candidate.charCodeAt(index);
        if (code <= 0x1f || code === 0x7f) {
            return false;
        }
    }

    try {
        const url = new URL(candidate);
        const secureWebUrl = url.protocol === 'https:'
            && !url.username
            && !url.password
            && (!url.port || url.port === '443');
        if (!secureWebUrl) {
            return false;
        }

        const host = url.hostname.toLowerCase();
        if (page.allowedHosts.some(allowedHost => host === allowedHost.toLowerCase())) {
            return true;
        }

        return page.allowedUrls?.some(allowedUrl => {
            try {
                return new URL(allowedUrl).href === url.href;
            } catch {
                return false;
            }
        }) ?? false;
    } catch {
        return false;
    }
}

/**
 * Gerencia as páginas autorizadas do Painel e do Perfil SUAP em um InAppBrowser interno.
 * Não copia cookies, não lê conteúdo remoto e não envia a navegação ao Chrome.
 */
@Injectable({ providedIn: 'root' })
export class SuapProfileBrowserService {

    private attempt?: BrowserAttempt;
    private nextAttemptId = 0;
    private secureGovBrowserOpening = false;

    private readonly zone = inject(NgZone);
    private readonly govBrBrowser = inject(GovBrBrowserService);
    private readonly painelAva = inject(PainelAvaService);

    open(handlers: SuapProfileBrowserHandlers): void {
        this.openPage(SUAP_PROFILE_PAGE, handlers);
    }

    openPage(page: InternalBrowserPage, handlers: SuapProfileBrowserHandlers): void {
        if (!isAllowedInternalBrowserNavigation(page.url, page)) {
            this.run(() => handlers.onError('O endereço solicitado não está autorizado para abertura interna.'));

            return;
        }

        if (this.attempt || this.secureGovBrowserOpening) {
            this.run(() => handlers.onError('Já existe uma página aberta dentro do aplicativo.'));

            return;
        }

        const attempt: BrowserAttempt = {
            id: ++this.nextAttemptId,
            page,
            handlers,
            subscriptions: [],
            shown: false,
            terminal: false,
        };
        this.attempt = attempt;
        void this.prepareBrowser(attempt);
    }

    /**
     * Waits for the shared native browser before opening the requested page.
     *
     * @param attempt Interactive browser request that owns the reservation.
     * @returns Resolves after opening or disposing a superseded request.
     */
    private async prepareBrowser(attempt: BrowserAttempt): Promise<void> {
        const { page } = attempt;
        try {
            // A profile refresh uses the same native plugin and can replace this window
            // without an exit event. Drain it first and block new refreshes until exit.
            const release = await this.painelAva.acquireInAppBrowserLease();
            if (!this.isCurrent(attempt) || attempt.terminal) {
                release();

                return;
            }
            attempt.releaseBrowserLease = release;
            attempt.browser = CoreOpener.openInApp(page.url, {
                beforeload: 'get',
                clearcache: 'no',
                clearsessioncache: 'no',
                cleardata: 'no',
                hidden: 'yes',
                // Usa o layout Android IFRN de insets já aplicado ao login SUAP.
                ifrnlayoutfullscreen: 'yes',
                location: 'yes',
                footer: 'no',
                toolbarcolor: '#1351b4',
                navigationbuttoncolor: '#ffffff',
                hardwareback: 'yes',
            });

            this.subscribe(attempt, 'beforeload', event => this.handleNavigation(attempt, event.url, true));
            this.subscribe(attempt, 'loadstart', event => this.handleNavigation(attempt, event.url, false));
            this.subscribe(attempt, 'loadstop', event => this.handleLoadStop(attempt, event.url));
            this.subscribe(attempt, 'loaderror', () => this.fail(
                attempt,
                `Não foi possível carregar ${page.title}. Verifique a conexão e tente novamente.`,
            ));
            this.subscribe(attempt, 'exit', () => this.finish(attempt));
        } catch {
            this.fail(attempt, `Não foi possível abrir ${page.title} dentro do aplicativo.`);
        }
    }

    close(): void {
        const attempt = this.attempt;
        if (!attempt || attempt.terminal) {
            return;
        }

        attempt.terminal = true;
        if (!attempt.browser) {
            this.finish(attempt);

            return;
        }
        try {
            attempt.browser.close();
        } catch {
            this.finish(attempt);
        }
    }

    private subscribe(
        attempt: BrowserAttempt,
        eventName: string,
        callback: (event: { url: string }) => void,
    ): void {
        if (!attempt.browser) {
            return;
        }

        attempt.subscriptions.push(attempt.browser.on(eventName).subscribe(event => {
            if (this.isCurrent(attempt) && (!attempt.terminal || eventName === 'exit')) {
                callback(event);
            }
        }));
    }

    private handleNavigation(attempt: BrowserAttempt, url: string, paused: boolean): void {
        if (!url) {
            this.fail(attempt, 'A página solicitou um endereço inválido.');

            return;
        }

        if (isAllowedInternalBrowserNavigation(url, attempt.page)) {
            if (paused) {
                attempt.browser?._loadAfterBeforeload(url);
            }

            return;
        }

        if (isGovBrAuthorizationUrl(url)) {
            this.handoffToSecureGovBrowser(attempt, url);

            return;
        }

        this.fail(attempt, `${attempt.page.title} tentou abrir um endereço não autorizado.`);
    }

    private handleLoadStop(attempt: BrowserAttempt, url: string): void {
        if (!isAllowedInternalBrowserNavigation(url, attempt.page)) {
            this.handleNavigation(attempt, url, false);

            return;
        }

        if (attempt.shown) {
            return;
        }

        attempt.shown = true;
        try {
            attempt.browser?.show();
            this.run(() => attempt.handlers.onReady());
        } catch {
            this.fail(attempt, `Não foi possível exibir ${attempt.page.title} dentro do aplicativo.`);
        }
    }

    private handoffToSecureGovBrowser(attempt: BrowserAttempt, url: string): void {
        if (attempt.govRedirect || !this.isCurrent(attempt)) {
            return;
        }

        attempt.govRedirect = url;
        attempt.terminal = true;
        try {
            attempt.browser?.close();
        } catch {
            this.finish(attempt);
        }
    }

    private finish(attempt: BrowserAttempt): void {
        if (!this.isCurrent(attempt)) {
            return;
        }

        const govRedirect = attempt.govRedirect;
        this.dispose(attempt);

        if (govRedirect) {
            this.openSecureGovBrowser(govRedirect, attempt.handlers, attempt.page.title);

            return;
        }

        this.run(() => attempt.handlers.onExit());
    }

    private openSecureGovBrowser(url: string, handlers: SuapProfileBrowserHandlers, pageTitle: string): void {
        this.secureGovBrowserOpening = true;
        const returned = (): void => {
            this.secureGovBrowserOpening = false;
            this.run(() => handlers.onError(
                `O SUAP solicitou autenticação Gov.br. Ao voltar, tente abrir ${pageTitle} novamente.`,
            ));
        };

        void this.govBrBrowser.open(url, returned)
            .catch(() => {
                this.secureGovBrowserOpening = false;
                this.run(() => handlers.onError(
                    'Não foi possível abrir a autenticação segura do Gov.br. Tente novamente pelo SUAP.',
                ));
            });
    }

    private fail(attempt: BrowserAttempt, message: string): void {
        if (!this.isCurrent(attempt) || attempt.terminal) {
            return;
        }

        attempt.terminal = true;
        this.run(() => attempt.handlers.onError(message));
        if (!attempt.browser) {
            this.finish(attempt);

            return;
        }

        try {
            attempt.browser.close();
        } catch {
            this.finish(attempt);
        }
    }

    private dispose(attempt: BrowserAttempt): void {
        attempt.subscriptions.forEach(subscription => subscription.unsubscribe());
        attempt.subscriptions = [];
        attempt.releaseBrowserLease?.();
        attempt.releaseBrowserLease = undefined;
        if (this.attempt === attempt) {
            this.attempt = undefined;
        }
    }

    private isCurrent(attempt: BrowserAttempt): boolean {
        return this.attempt === attempt && attempt.id === this.nextAttemptId;
    }

    private run(callback: () => void): void {
        this.zone.run(callback);
    }

}
