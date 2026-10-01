import { Component, OnInit, inject } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { CoreAlerts } from '@services/overlays/alerts';
import { CoreLang } from '@services/lang';
import { CorePlatform } from '@services/platform';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'page-marketplace-ifrn',
    templateUrl: './marketplace-ifrn.html',
    styleUrls: ['./marketplace-ifrn.scss'],
    imports: [CoreSharedModule],
})
export class MarketplaceIfrnPage implements OnInit {

    private readonly painelAvaService = inject(PainelAvaService);

    readonly currentYear = new Date().getFullYear();
    readonly welcomeImageSrc = 'mobilemoodle/static/theme/ifrn/img/alunos-ifrn-welcome.webp';

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
        this.canContinue = this.painelAvaService.hasDashboard();
    }

    /** Reabre o Painel quando os dados da sessão atual já estão disponíveis. */
    continueSession(): void {
        if (this.loading) {
            return;
        }

        if (this.painelAvaService.hasDashboard()) {
            this.openingPainel = true;
            this.openPainel();
            return;
        }

        void this.enterAva();
    }

    /**
     * Executa diretamente o mesmo OAuth web do Painel AVA que já funcionava
     * no login antigo. O Marketplace apenas inicia o fluxo e, ao receber os
     * diários, abre a SPA do Painel. Não existe etapa intermediária de login.
     */
    async enterAva(): Promise<void> {
        if (this.loading) {
            return;
        }

        this.loading = true;

        try {
            const result = await firstValueFrom(this.painelAvaService.authenticateWithBrowser());

            // eslint-disable-next-line no-console
            console.log(`[IFRN-MARKETPLACE] OAuth concluído; ${result.diariosCount} diário(s). Abrindo Painel.`);
            this.canContinue = true;
            this.openingPainel = true;
            this.openPainel();
        } catch (error) {
            // Cancelar o navegador não deve deixar o Marketplace em estado quebrado.
            const message = error instanceof Error ? error.message : 'Não foi possível concluir o acesso ao AVA.';

            if (!/cancelad/i.test(message)) {
                void CoreAlerts.showError(message);
            }
        } finally {
            this.loading = false;
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

    openHelp(): void {
        window.open('https://ajuda.ead.ifrn.edu.br/', '_blank', 'noopener,noreferrer');
    }
}
