import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CoreSharedModule } from '@/core/shared.module';
import { AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { BiometricService } from '@/MoodleIFRN/services_mobile/biometric.service';
import { CorePlatform } from '@services/platform';

@Component({
    selector: 'page-marketplace-ifrn',
    templateUrl: './marketplace-ifrn.html',
    styleUrls: ['./marketplace-ifrn.scss'],
    imports: [
        CoreSharedModule,
    ],
})
export class MarketplaceIfrnPage implements OnInit {

    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly biometricService = inject(BiometricService);

    readonly currentYear = new Date().getFullYear();

    readonly welcomeImageSrc =
        'mobilemoodle/static/theme/ifrn/img/alunos-ifrn-welcome.webp';

    /** Há sessão válida ou biometria para retomada rápida. */
    canContinue = false;

    /** Rótulo do CTA secundário, ex.: "Continuar como 2023123456". */
    continueLabel = '';

    /**
     * Detecta sessão/biometria para o CTA “Continuar como…”.
     */
    async ngOnInit(): Promise<void> {
        await CorePlatform.ready();

        const hasSession = this.authService.isAuthenticated();
        const biometricAvailable = await this.biometricService.isAvailable();
        const biometricEnabled =
            biometricAvailable && this.biometricService.isEnabled();

        this.canContinue = hasSession || biometricEnabled;

        const username = this.authService.getUsername()?.trim();

        if (username) {
            this.continueLabel = `Continuar como ${username}`;
        } else if (hasSession) {
            this.continueLabel = 'Continuar no AVA';
        } else {
            this.continueLabel = 'Continuar com biometria';
        }
    }

    /**
     * Retoma sessão (painel) ou abre o login (biometria automática).
     */
    continueSession(): void {
        if (this.authService.isAuthenticated()) {
            this.authService.openMobileMoodle('/painel');

            return;
        }

        void this.router.navigate(['/login/ifrn-login']);
    }

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
