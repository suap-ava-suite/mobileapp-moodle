import { AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { Component, OnInit, inject } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { CoreLang } from '@services/lang';
import { CorePlatform } from '@services/platform';
import { CoreNavigator } from '@services/navigator';
import { MoodleSiteService } from '@/MoodleIFRN/services_mobile/moodle-site.service';

@Component({
    selector: 'page-marketplace-ifrn',
    templateUrl: './marketplace-ifrn.html',
    styleUrls: ['./marketplace-ifrn.scss'],
    imports: [CoreSharedModule],
})
export class MarketplaceIfrnPage implements OnInit {

    private readonly authService = inject(AuthService);
    private readonly painelAvaService = inject(PainelAvaService);
    private readonly moodleSite = inject(MoodleSiteService);

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
        if (CoreNavigator.getRouteBooleanParam('ifrnEntry')) {
            this.openingPainel = true;
            await this.moodleSite.openIfrnEntry();

            return;
        }

        this.canContinue = this.painelAvaService.hasDashboard() || !!this.authService.getUsername();
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
     * Volta ao login IFRN-id/senha. O login antigo mantém o token SUAP
     * no app e permite consultar /api/rh/eu/ para obter o perfil oficial.
     */
    async enterAva(): Promise<void> {
        if (this.loading) {
            return;
        }

        this.loading = true;

        try {
            const base = document.querySelector('base')?.getAttribute('href') || '/';
            const root = base.endsWith('/') ? base : `${base}/`;
            const url = new URL(`${root}login/ifrn-login`, window.location.origin);

            window.location.assign(url.toString());
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
