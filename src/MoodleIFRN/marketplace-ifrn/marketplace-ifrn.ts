// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, NgZone, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { readNativeSuapEntry } from '../navigation/suap-entry-state';
import { CoreSharedModule } from '@/core/shared.module';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { CorePlatform } from '@services/platform';
import { CoreNavigator } from '@services/navigator';
import { CoreOpener } from '@static/opener';
import { SuapEntryService, SuapEntryAccountError } from '@/MoodleIFRN/services_mobile/suap-entry.service';
import { reportSuapDuration } from '../services_mobile/suap-login-telemetry';
import { CoreEvents } from '@static/events';
import { GOVBR_MOBILE_UNAVAILABLE_MESSAGE } from '../services_mobile/painel-ava.config';
import { GovBrBrowserService } from '../services_mobile/govbr-browser.service';

@Component({
    selector: 'page-marketplace-ifrn',
    templateUrl: './marketplace-ifrn.html',
    styleUrls: ['../moodle-open-course/moodle-open-course.scss', './marketplace-ifrn.scss'],
    imports: [CoreSharedModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketplaceIfrnPage implements OnInit, OnDestroy {

    private readonly authService = inject(AuthService);
    private readonly painelAvaService = inject(PainelAvaService);
    private readonly suapEntry = inject(SuapEntryService);
    private readonly govBrBrowser = inject(GovBrBrowserService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly zone = inject(NgZone);
    private returnSubscription?: Subscription;
    private mobileAuthFailureObserver?: { off: () => void };
    private readonly accountIssueState = signal<SuapEntryAccountError | null>(null);
    private readonly accountSwitchStartedState = signal(false);
    private readonly formErrorState = signal('');
    private readonly govBrUnavailableState = signal(false);
    private readonly govBrBrowserOpenedState = signal(false);
    private readonly govBrBrowserOpeningState = signal(false);
    private readonly govBrBrowserReturnedState = signal(false);
    private readonly govBrBrowserErrorState = signal('');
    private readonly statusMessageState = signal('');

    // Os getters mantêm os templates/handlers existentes e registram as
    // dependências dos signals durante a renderização OnPush.
    get accountIssue(): SuapEntryAccountError | null { return this.accountIssueState(); }
    set accountIssue(value: SuapEntryAccountError | null) { this.accountIssueState.set(value); }
    get accountSwitchStarted(): boolean { return this.accountSwitchStartedState(); }
    set accountSwitchStarted(value: boolean) { this.accountSwitchStartedState.set(value); }
    get formError(): string { return this.formErrorState(); }
    set formError(value: string) { this.formErrorState.set(value); }
    get govBrUnavailable(): boolean { return this.govBrUnavailableState(); }
    set govBrUnavailable(value: boolean) { this.govBrUnavailableState.set(value); }
    get govBrBrowserOpened(): boolean { return this.govBrBrowserOpenedState(); }
    set govBrBrowserOpened(value: boolean) { this.govBrBrowserOpenedState.set(value); }
    get govBrBrowserOpening(): boolean { return this.govBrBrowserOpeningState(); }
    set govBrBrowserOpening(value: boolean) { this.govBrBrowserOpeningState.set(value); }
    get govBrBrowserReturned(): boolean { return this.govBrBrowserReturnedState(); }
    set govBrBrowserReturned(value: boolean) { this.govBrBrowserReturnedState.set(value); }
    get govBrBrowserError(): string { return this.govBrBrowserErrorState(); }
    set govBrBrowserError(value: string) { this.govBrBrowserErrorState.set(value); }
    get statusMessage(): string { return this.statusMessageState(); }
    set statusMessage(value: string) { this.statusMessageState.set(value); }
    private nativeReturnQueued = false;
    private expectedIdentity = '';
    private readonly onResume = (): void => {
        if (!this.govBrBrowserOpened && !this.govBrBrowserOpening) {
            return;
        }

        this.zone.run(() => {
            this.govBrBrowser.onBrowserReturned();
            this.govBrBrowserOpening = false;
            this.govBrBrowserOpened = false;
            this.govBrBrowserReturned = true;
            this.govBrUnavailable = true;
        });
    };

    /**
     * Garante que o overlay já esteja pintado antes de abrir o InAppBrowser nativo.
     *
     * @returns Conclui após dois ciclos de pintura.
     */
    private async waitForTransitionPaint(): Promise<void> {
        await new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => resolve());
            });
        });
    }

    readonly currentYear = new Date().getFullYear();
    readonly welcomeImageSrc = 'mobilemoodle/static/theme/ifrn/img/alunos-ifrn-biblioteca-enhanced.webp';

    private readonly canContinueState = signal(false);
    get canContinue(): boolean { return this.canContinueState(); }
    set canContinue(value: boolean) { this.canContinueState.set(value); }

    readonly continueLabel = 'Continuar no AVA';
    private readonly loadingState = signal(false);
    get loading(): boolean { return this.loadingState(); }
    set loading(value: boolean) { this.loadingState.set(value); }
    /** OAuth Moodle/SUAP aberto no navegador externo; overlay permanece até o retorno. */
    private readonly waitingBrowserState = signal(false);
    get waitingBrowser(): boolean { return this.waitingBrowserState(); }
    set waitingBrowser(value: boolean) { this.waitingBrowserState.set(value); }
    private readonly openingPainelState = signal(false);
    get openingPainel(): boolean { return this.openingPainelState(); }
    set openingPainel(value: boolean) { this.openingPainelState.set(value); }

    /** Overlay de transição cobre preparação, navegador seguro e abertura do Painel. */
    private readonly showTransitionState = computed(() => this.loadingState() || this.waitingBrowserState()
        || this.openingPainelState() || this.govBrBrowserOpeningState());

    get showTransition(): boolean { return this.showTransitionState(); }

    private readonly transitionCaptionState = computed(() => {
        if (this.govBrBrowserOpeningState()) {
            return 'Abrindo o navegador seguro...';
        }
        if (this.waitingBrowserState()) {
            return 'Conclua o login no navegador';
        }
        if (this.openingPainelState()) {
            return 'Abrindo painel...';
        }
        if (this.statusMessageState()) {
            return this.statusMessageState();
        }

        return 'Carregando painel...';
    });

    get transitionCaption(): string { return this.transitionCaptionState(); }

    /**
     * O Marketplace é a única tela de entrada.
     * Não dispara biometria nem redireciona para o antigo ifrn-login.
     */
    async ngOnInit(): Promise<void> {
        await CorePlatform.ready();
        document.addEventListener('resume', this.onResume);
        this.mobileAuthFailureObserver = CoreEvents.on('IFRN_SUAP_MOBILE_AUTH_FAILED', event => {
            const message = (event as unknown as { message?: unknown })?.message;
            this.formError = typeof message === 'string'
                ? message : 'Não foi possível concluir o login SUAP. Tente novamente.';
            this.loading = false;
            this.waitingBrowser = false;
            this.openingPainel = false;
            this.statusMessage = '';
        });
        const pendingAuthError = sessionStorage.getItem('ifrn_mobile_suap_error_v1');
        if (pendingAuthError) {
            this.formError = pendingAuthError;
            sessionStorage.removeItem('ifrn_mobile_suap_error_v1');
        }
        const forceLogin = CoreNavigator.getRouteBooleanParam('forceLogin');
        this.expectedIdentity = forceLogin ? CoreNavigator.getRouteParam<string>('username') || '' : '';
        this.canContinue = !forceLogin && this.authService.isAuthenticated() && this.painelAvaService.hasDashboard();
        // Angular pode reutilizar o marketplace ao mudar apenas a query do retorno.
        // Não depender exclusivamente de ngOnInit para concluir o OAuth.
        this.returnSubscription = this.route.queryParamMap.subscribe(params => {
            if (params.get('nativeSuapReturn') === 'true') {
                this.nativeReturnQueued = true;
                void this.completeNativeReturn();
            }
        });
        if (CoreNavigator.getRouteBooleanParam('nativeSuapReturn')) {
            this.nativeReturnQueued = true;
            await this.completeNativeReturn();
            return;
        }
        if (CoreNavigator.getRouteBooleanParam('directSuap')) {
            await this.enterAva();
        }
    }

    /** Ionic mantém telas em cache; este retorno nem sempre dispara ngOnInit. */
    ionViewWillEnter(): void {
        this.canContinue = !this.expectedIdentity && this.authService.isAuthenticated()
            && this.painelAvaService.hasDashboard();

        if (CoreNavigator.getRouteBooleanParam('nativeSuapReturn')) {
            this.nativeReturnQueued = true;
            void this.completeNativeReturn();
            return;
        }
        // Voltou do navegador sem callback ainda: mantém o splash em vez da tela inicial.
        if (readNativeSuapEntry() && !this.loading && !this.waitingBrowser) {
            this.waitingBrowser = true;
            this.loading = true;
            this.statusMessage = 'Conclua o login no navegador';
        }
    }

    ngOnDestroy(): void {
        this.returnSubscription?.unsubscribe();
        this.mobileAuthFailureObserver?.off();
        document.removeEventListener('resume', this.onResume);
        this.painelAvaService.clearGovBrRedirectUrl();
    }

    ionViewDidEnter(): void {
        document.documentElement.classList.remove('ifrn-course-context');
    }

    private async completeNativeReturn(): Promise<void> {
        if (this.loading && !this.waitingBrowser) {
            this.nativeReturnQueued = true;
            return;
        }
        if (!readNativeSuapEntry()) {
            this.waitingBrowser = false;
            return;
        }
        this.nativeReturnQueued = false;
        this.waitingBrowser = false;
        this.loading = true;
        this.canContinue = false;
        this.formError = '';
        try {
            await this.suapEntry.complete(message => this.statusMessage = message);
        } catch (error) {
            this.accountIssue = error instanceof SuapEntryAccountError ? error : null;
            this.accountSwitchStarted = false;
            this.formError = error instanceof Error ? error.message : 'Não foi possível concluir a entrada no AVA.';
        } finally {
            this.loading = false;
            this.waitingBrowser = false;
            this.statusMessage = '';
        }
    }

    /** Reabre o Painel quando os dados da sessão atual já estão disponíveis. */
    continueSession(): void {
        if (this.loading || this.waitingBrowser) {
            return;
        }

        if (this.authService.isAuthenticated() && this.painelAvaService.hasDashboard()) {
            this.openingPainel = true;
            this.openPainel();
            return;
        }

        void this.enterAva();
    }

    /** Inicia o SUAP diretamente a partir do gesto no marketplace. */
    async enterAva(): Promise<void> {
        if (this.loading || this.waitingBrowser || this.openingPainel) {
            return;
        }
        const entryStartedAt = performance.now();
        this.accountIssue = null;
        this.accountSwitchStarted = false;
        this.govBrUnavailable = false;
        this.govBrBrowserOpened = false;
        this.govBrBrowserOpening = false;
        this.govBrBrowserReturned = false;
        this.govBrBrowserError = '';
        this.loading = true;
        this.waitingBrowser = false;
        this.nativeReturnQueued = false;
        this.formError = '';
        this.statusMessage = 'Acessando o SUAP…';
        let openGovBrImmediately = false;
        try {
            // Um novo retorno deve mudar a query, mesmo na tela Ionic em cache.
            await this.router.navigate([], { relativeTo: this.route, replaceUrl: true,
                queryParams: { nativeSuapReturn: null }, queryParamsHandling: 'merge' });
            await this.waitForTransitionPaint();
            reportSuapDuration('marketplace-preflight', performance.now() - entryStartedAt);
            await this.suapEntry.loginWithSuap(this.expectedIdentity, message => this.statusMessage = message);
            // OAuth fica no navegador do sistema; mantém o splash até o callback.
            if (readNativeSuapEntry()) {
                this.waitingBrowser = true;
                this.statusMessage = 'Conclua o login no navegador';
                return;
            }
        } catch (error) {
            this.accountIssue = error instanceof SuapEntryAccountError ? error : null;
            this.govBrUnavailable = error instanceof Error && error.message === GOVBR_MOBILE_UNAVAILABLE_MESSAGE;
            openGovBrImmediately = this.govBrUnavailable;
            this.govBrBrowserOpened = false;
            this.govBrBrowserReturned = false;
            this.govBrBrowserError = '';
            this.formError = this.govBrUnavailable ? ''
                : error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.';
        } finally {
            if (!this.waitingBrowser) {
                this.loading = false;
                this.openingPainel = false;
                this.statusMessage = '';
                this.canContinue = !this.expectedIdentity && this.authService.isAuthenticated()
                    && this.painelAvaService.hasDashboard();
            }
        }
        if (openGovBrImmediately) {
            await this.continueGovBrInBrowser();
            return;
        }
        // O retorno pode chegar antes de openBrowserForOAuthLogin resolver.
        // Reprocessar depois de liberar loading em vez de descartá-lo.
        if (this.nativeReturnQueued) {
            await this.completeNativeReturn();
        }
    }

    /**
     * Abre a SPA do Painel sem exigir o JWT do login antigo por IFRN-id/senha.
     * A fonte de autenticação agora é a sessão web criada pelo OAuth oficial.
     */
    private openPainel(): void {
        this.openingPainel = false;
        void CoreNavigator.navigate('/login/painel');
    }

    /**
     * Abre em Custom Tab Android ou navegador externo o redirect recebido do SUAP.
     *
     * @returns Conclui quando o navegador confirma que foi aberto.
     */
    async continueGovBrInBrowser(): Promise<void> {
        if (!this.govBrUnavailable || this.showTransition || this.govBrBrowserOpened || this.govBrBrowserOpening) {
            return;
        }

        const redirectUrl = this.painelAvaService.consumeGovBrRedirectUrl();
        if (!redirectUrl) {
            this.govBrBrowserError = 'O link oficial expirou. Volte ao login SUAP e inicie novamente.';
            return;
        }

        this.govBrBrowserOpening = true;
        this.govBrBrowserError = '';
        this.govBrBrowserReturned = false;
        try {
            await this.govBrBrowser.open(redirectUrl, () => {
                this.zone.run(() => {
                    this.govBrBrowserOpening = false;
                    this.govBrBrowserOpened = false;
                    this.govBrBrowserReturned = true;
                    this.govBrUnavailable = true;
                });
            });
            this.govBrBrowserError = '';
            this.govBrBrowserOpening = false;
            this.govBrBrowserOpened = true;
        } catch {
            this.govBrBrowserOpening = false;
            this.govBrBrowserError = 'Não foi possível abrir o navegador seguro. Tente novamente pelo login SUAP.';
        }
    }

    /** Retorna ao fluxo SUAP tradicional embutido no app. */
    retrySuapInApp(): void {
        if (!this.govBrUnavailable || this.showTransition || this.govBrBrowserOpened || this.govBrBrowserOpening) {
            return;
        }

        this.govBrUnavailable = false;
        this.govBrBrowserOpened = false;
        this.govBrBrowserReturned = false;
        this.govBrBrowserError = '';
        this.painelAvaService.clearGovBrRedirectUrl();
        this.formError = '';
        void this.enterAva();
    }

    /**
     * Painel: reinicia a entrada exigindo a matrícula correta. O serviço já
     * abre o InAppBrowser sem reaproveitar cookies quando há expectedIdentity.
     * Moodle: mantém a saída oficial no mesmo navegador usado pelo OAuth.
     */
    async recoverAccount(): Promise<void> {
        if (this.showTransition || !this.accountIssue) {
            return;
        }
        this.expectedIdentity = this.accountIssue.expectedLogin;
        if (this.accountIssue.source === 'painel') {
            await this.enterAva();
            return;
        }
        this.accountSwitchStarted = true;
        CoreOpener.openInApp('https://academico.ava.ifrn.edu.br/auth/suap/logout.php', {
            location: 'no', clearcache: 'no', clearsessioncache: 'no',
        });
    }

    /** Depois da saída na web, reinicia a entrada com a matrícula esperada. */
    async continueCorrectAccount(): Promise<void> {
        if (this.showTransition || !this.accountIssue || !this.accountSwitchStarted) {
            return;
        }
        this.expectedIdentity = this.accountIssue.expectedLogin;
        this.accountSwitchStarted = false;
        // expectedIdentity faz a consulta do painel iniciar sem reutilizar cookies.
        await this.enterAva();
    }

    dismissAccountIssue(): void {
        if (this.showTransition) {
            return;
        }
        this.accountIssue = null;
        this.accountSwitchStarted = false;
        this.formError = '';
        this.suapEntry.cancel();
        this.canContinue = !this.expectedIdentity && this.authService.isAuthenticated()
            && this.painelAvaService.hasDashboard();
    }

    cancelConnection(): void {
        this.suapEntry.cancelConnection();
        this.suapEntry.cancel();
        this.painelAvaService.clearGovBrRedirectUrl();
        this.govBrUnavailable = false;
        this.govBrBrowserOpened = false;
        this.govBrBrowserReturned = false;
        this.waitingBrowser = false;
        this.loading = false;
        this.openingPainel = false;
        this.statusMessage = '';
        this.canContinue = !this.expectedIdentity && this.authService.isAuthenticated()
            && this.painelAvaService.hasDashboard();
    }

    openHelp(): void {
        window.open('https://ajuda.ead.ifrn.edu.br/', '_blank', 'noopener,noreferrer');
    }
}
