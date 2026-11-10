/* eslint-disable header/header */
import { inject, Injectable, NgZone } from '@angular/core';
import { CoreOpener } from '@static/opener';
import { GovBrBrowserService, isGovBrAuthorizationUrl } from './govbr-browser.service';

export const SUAP_PROFILE_URL = 'https://suap.ifrn.edu.br/comum/minha_conta/';

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
    browser?: SuapProfileBrowser;
    handlers: SuapProfileBrowserHandlers;
    subscriptions: BrowserSubscription[];
    shown: boolean;
    terminal: boolean;
    govRedirect?: string;
}

/**
 * Aceita somente navegações HTTPS do host oficial do SUAP.
 *
 * @param candidate URL que será verificada antes da navegação.
 * @returns Se o destino pertence ao host oficial do SUAP.
 */
export function isAllowedSuapProfileNavigation(candidate: string): boolean {
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

        return url.protocol === 'https:'
            && url.hostname.toLowerCase() === 'suap.ifrn.edu.br'
            && !url.username
            && !url.password
            && (!url.port || url.port === '443');
    } catch {
        return false;
    }
}

/**
 * Gerencia a página oficial do Perfil SUAP em um InAppBrowser interno.
 * Não copia cookies, não lê conteúdo remoto e não envia a navegação ao Chrome.
 */
@Injectable({ providedIn: 'root' })
export class SuapProfileBrowserService {

    private attempt?: BrowserAttempt;
    private nextAttemptId = 0;
    private secureGovBrowserOpening = false;

    private readonly zone = inject(NgZone);
    private readonly govBrBrowser = inject(GovBrBrowserService);

    open(handlers: SuapProfileBrowserHandlers): void {
        if (this.attempt || this.secureGovBrowserOpening) {
            this.run(() => handlers.onError('Já existe uma janela do Perfil SUAP aberta.'));

            return;
        }

        const attempt: BrowserAttempt = {
            id: ++this.nextAttemptId,
            handlers,
            subscriptions: [],
            shown: false,
            terminal: false,
        };
        this.attempt = attempt;

        try {
            attempt.browser = CoreOpener.openInApp(SUAP_PROFILE_URL, {
                beforeload: 'get',
                clearcache: 'no',
                clearsessioncache: 'no',
                cleardata: 'no',
                hidden: 'yes',
                location: 'yes',
                closebuttoncaption: 'Fechar',
                closebuttoncolor: '#ffffff',
                footer: 'yes',
                footercolor: '#1351b4',
                toolbarcolor: '#1351b4',
                navigationbuttoncolor: '#ffffff',
                hardwareback: 'yes',
            });

            this.subscribe(attempt, 'beforeload', event => this.handleNavigation(attempt, event.url, true));
            this.subscribe(attempt, 'loadstart', event => this.handleNavigation(attempt, event.url, false));
            this.subscribe(attempt, 'loadstop', event => this.handleLoadStop(attempt, event.url));
            this.subscribe(attempt, 'loaderror', () => this.fail(
attempt,
                'Não foi possível carregar o Perfil SUAP. Verifique a conexão e tente novamente.',
));
            this.subscribe(attempt, 'exit', () => this.finish(attempt));
        } catch {
            this.fail(attempt, 'Não foi possível abrir o Perfil SUAP dentro do aplicativo.');
        }
    }

    close(): void {
        const attempt = this.attempt;
        if (!attempt || attempt.terminal) {
            return;
        }

        attempt.terminal = true;
        try {
            attempt.browser?.close();
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
            this.fail(attempt, 'O SUAP solicitou um endereço inválido.');

            return;
        }

        if (isAllowedSuapProfileNavigation(url)) {
            if (paused) {
                attempt.browser?._loadAfterBeforeload(url);
            }

            return;
        }

        if (isGovBrAuthorizationUrl(url)) {
            this.handoffToSecureGovBrowser(attempt, url);

            return;
        }

        this.fail(attempt, 'O Perfil SUAP tentou abrir um endereço não autorizado.');
    }

    private handleLoadStop(attempt: BrowserAttempt, url: string): void {
        if (!isAllowedSuapProfileNavigation(url)) {
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
            this.fail(attempt, 'Não foi possível exibir o Perfil SUAP dentro do aplicativo.');
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
            this.openSecureGovBrowser(govRedirect, attempt.handlers);

            return;
        }

        this.run(() => attempt.handlers.onExit());
    }

    private openSecureGovBrowser(url: string, handlers: SuapProfileBrowserHandlers): void {
        this.secureGovBrowserOpening = true;
        const returned = (): void => {
            this.secureGovBrowserOpening = false;
            this.run(() => handlers.onError(
                'O SUAP solicitou autenticação Gov.br. Ao voltar, tente abrir o Perfil SUAP novamente.',
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
