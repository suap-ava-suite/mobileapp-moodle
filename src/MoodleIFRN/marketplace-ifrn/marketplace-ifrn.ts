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
import { SuapEntryService } from '@/MoodleIFRN/services_mobile/suap-entry.service';

@Component({
    selector: 'page-marketplace-ifrn',
    templateUrl: './marketplace-ifrn.html',
    styleUrls: ['./marketplace-ifrn.scss'],
    imports: [CoreSharedModule],
})
export class MarketplaceIfrnPage implements OnInit, OnDestroy {

    private readonly authService = inject(AuthService);
    private readonly painelAvaService = inject(PainelAvaService);
    private readonly suapEntry = inject(SuapEntryService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private returnSubscription?: Subscription;
    formError = '';
    statusMessage = '';
    private nativeReturnQueued = false;
    private expectedIdentity = '';

    readonly currentYear = new Date().getFullYear();
    readonly welcomeImageSrc = 'mobilemoodle/static/theme/ifrn/img/alunos-ifrn-biblioteca-enhanced.webp';

    canContinue = false;
    continueLabel = 'Continuar no AVA';
    loading = false;
    openingPainel = false;

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
        if (CoreNavigator.getRouteBooleanParam('nativeSuapReturn')) {
            this.nativeReturnQueued = true;
            void this.completeNativeReturn();
        }
    }

    ngOnDestroy(): void {
        this.returnSubscription?.unsubscribe();
    }

    private async completeNativeReturn(): Promise<void> {
        if (this.loading) {
            this.nativeReturnQueued = true;
            return;
        }
        if (!readNativeSuapEntry()) {
            return;
        }
        this.nativeReturnQueued = false;
        this.loading = true;
        this.canContinue = false;
        this.formError = '';
        try {
            await this.suapEntry.complete(message => this.statusMessage = message);
        } catch (error) {
            this.formError = error instanceof Error ? error.message : 'Não foi possível concluir a entrada no AVA.';
        } finally {
            this.loading = false;
            this.statusMessage = '';
        }
    }

    /** Reabre o Painel quando os dados da sessão atual já estão disponíveis. */
    continueSession(): void {
        if (this.loading) {
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
        if (this.loading || this.openingPainel) {
            return;
        }
        this.loading = true;
        this.nativeReturnQueued = false;
        this.formError = '';
        try {
            // Um novo retorno deve mudar a query, mesmo na tela Ionic em cache.
            await this.router.navigate([], { relativeTo: this.route, replaceUrl: true,
                queryParams: { nativeSuapReturn: null }, queryParamsHandling: 'merge' });
            await this.suapEntry.login(this.expectedIdentity, message => this.statusMessage = message);
        } catch (error) {
            this.formError = error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.';
        } finally {
            this.loading = false;
            this.openingPainel = false;
            this.statusMessage = '';
            this.canContinue = !this.expectedIdentity && this.authService.isAuthenticated() && this.painelAvaService.hasDashboard();
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
        const base = document.querySelector('base')?.getAttribute('href') || '/';
        const root = base.endsWith('/') ? base : `${base}/`;
        const url = new URL(`${root}mobilemoodle/index.html`, window.location.origin);
        const language = CoreLang.getCurrentLanguageSync();

        if (language) {
            url.searchParams.set('lang', language);
        }

        url.hash = '/painel';
        window.location.assign(url.toString());
    }

    cancelConnection(): void {
        this.suapEntry.cancelConnection();
    }

    openHelp(): void {
        window.open('https://ajuda.ead.ifrn.edu.br/', '_blank', 'noopener,noreferrer');
    }
}
