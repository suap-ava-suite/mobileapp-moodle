import { AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { readNativeSuapEntry } from '../navigation/suap-entry-state';
import { CoreSharedModule } from '@/core/shared.module';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { CoreLang } from '@services/lang';
import { CorePlatform } from '@services/platform';
import { CoreNavigator } from '@services/navigator';
import { SuapEntryService, SuapEntryAccountError } from '@/MoodleIFRN/services_mobile/suap-entry.service';

@Component({
    selector: 'page-marketplace-ifrn',
    templateUrl: './marketplace-ifrn.html',
    styleUrls: ['../moodle-open-course/moodle-open-course.scss', './marketplace-ifrn.scss'],
    imports: [CoreSharedModule],
})
export class MarketplaceIfrnPage implements OnInit, OnDestroy {

    private readonly authService = inject(AuthService);
    private readonly painelAvaService = inject(PainelAvaService);
    private readonly suapEntry = inject(SuapEntryService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private returnSubscription?: Subscription;
    accountIssue: SuapEntryAccountError | null = null;
    accountSwitchStarted = false;
    formError = '';
    statusMessage = '';
    private nativeReturnQueued = false;
    private expectedIdentity = '';

    readonly currentYear = new Date().getFullYear();
    readonly welcomeImageSrc = 'mobilemoodle/static/theme/ifrn/img/alunos-ifrn-biblioteca-enhanced.webp';

    canContinue = false;
    continueLabel = 'Continuar no AVA';
    loading = false;
    /** OAuth Moodle/SUAP aberto no navegador externo; overlay permanece até o retorno. */
    waitingBrowser = false;
    openingPainel = false;

    /** Overlay de transição cobre preparação, OAuth externo e abertura do painel. */
    get showTransition(): boolean {
        return this.loading || this.waitingBrowser || this.openingPainel;
    }

    get transitionCaption(): string {
        if (this.waitingBrowser) {
            return 'Conclua o login no navegador';
        }
        if (this.openingPainel) {
            return 'Abrindo painel...';
        }
        if (this.statusMessage) {
            return this.statusMessage;
        }
        return 'Carregando painel...';
    }

    /**
     * O Marketplace é a única tela de entrada.
     * Não dispara biometria nem redireciona para o antigo ifrn-login.
     */
    async ngOnInit(): Promise<void> {
        await CorePlatform.ready();
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
        this.accountIssue = null;
        this.accountSwitchStarted = false;
        this.loading = true;
        this.waitingBrowser = false;
        this.nativeReturnQueued = false;
        this.formError = '';
        try {
            // Um novo retorno deve mudar a query, mesmo na tela Ionic em cache.
            await this.router.navigate([], { relativeTo: this.route, replaceUrl: true,
                queryParams: { nativeSuapReturn: null }, queryParamsHandling: 'merge' });
            await this.suapEntry.login(this.expectedIdentity, message => this.statusMessage = message);
            // OAuth fica no navegador do sistema; mantém o splash até o callback.
            if (readNativeSuapEntry()) {
                this.waitingBrowser = true;
                this.statusMessage = 'Conclua o login no navegador';
                return;
            }
        } catch (error) {
            this.formError = error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.';
        } finally {
            if (!this.waitingBrowser) {
                this.loading = false;
                this.openingPainel = false;
                this.statusMessage = '';
                this.canContinue = !this.expectedIdentity && this.authService.isAuthenticated()
                    && this.painelAvaService.hasDashboard();
            }
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
        window.open('https://academico.ava.ifrn.edu.br/auth/suap/logout.php', '_system');
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
