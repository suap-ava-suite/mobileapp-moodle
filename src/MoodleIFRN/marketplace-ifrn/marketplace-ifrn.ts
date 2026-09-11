import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CoreSharedModule } from '@/core/shared.module';

@Component({
    selector: 'page-marketplace-ifrn',
    templateUrl: './marketplace-ifrn.html',
    styleUrls: ['./marketplace-ifrn.scss'],
    imports: [
        CoreSharedModule,
    ],
})
export class MarketplaceIfrnPage {

    private readonly router = inject(Router);

    readonly currentYear = new Date().getFullYear();

    readonly ifrnSymbolSrc =
        'mobilemoodle/static/theme/ifrn/img/ifrn-symbol.svg';

    /**
     * Abre a tela de login do IFRN.
     */
    enterAva(): void {
        void this.router.navigate(['/login/ifrn-login']);
    }

    /**
     * Abre a central de ajuda do AVA IFRN.
     */
    openHelp(): void {
        window.open(
            'https://ajuda.ead.ifrn.edu.br/',
            '_blank',
            'noopener,noreferrer',
        );
    }
}
