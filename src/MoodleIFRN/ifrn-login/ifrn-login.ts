
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

import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CoreSharedModule } from '@/core/shared.module';
import { AuthResponse, AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { BiometricService } from '@/MoodleIFRN/services_mobile/biometric.service';
import { CoreAlerts } from '@services/overlays/alerts';
import { CorePlatform } from '@services/platform';
import { Translate } from '@singletons';
import { TimeoutError, firstValueFrom } from 'rxjs';

@Component({
    selector: 'page-ifrn-login',
    templateUrl: './ifrn-login.html',
    styleUrls: ['./ifrn-login.scss'],
    imports: [
        CoreSharedModule,
    ],
})
export class IfrnLoginPage implements OnInit {

    private readonly authService = inject(AuthService);
    private readonly biometricService = inject(BiometricService);
    private readonly router = inject(Router);

    username = '';
    password = '';

    showPassword = false;
    loading = false;

    biometricAvailable = false;
    biometricEnabled = false;

    canGoBack = true;

    private lastLoginAt = 0;

    /**
     * Volta para a tela anterior, que normalmente é o Marketplace IFRN.
     */
    goBack(): void {
        this.router.navigate(['/welcome']);
    }

    /**
     * Inicializa os recursos da página.
     */
    async ngOnInit(): Promise<void> {
        await CorePlatform.ready();

        this.biometricAvailable = await this.biometricService.isAvailable();

        this.biometricEnabled =
            this.biometricAvailable &&
            this.biometricService.isEnabled();
    }

    /**
     * Alterna a visualização da senha.
     */
    togglePassword(): void {
        this.showPassword = !this.showPassword;
    }

    /**
     * Autentica IFRN-id e senha na API do SUAP e abre o painel.
     */
    login(): void {
        if (this.loading) {
            return;
        }

        if (Date.now() - this.lastLoginAt < 800) {
            return;
        }

        const username = this.username
            .trim()
            .replace(/[\u0000-\u001F\u007F]/g, '');

        if (!username || !this.password) {
            void CoreAlerts.showError(
                'Por favor, preencha todos os campos.',
            );

            return;
        }

        // Limites alinhados ao schema do SUAP (/api/token/pair).
        if (username.length > 150 || this.password.length > 128) {
            void CoreAlerts.showError(
                'Credenciais inválidas.',
            );

            return;
        }

        const credentials = {
            username,
            password: this.password,
        };

        this.loading = true;
        this.lastLoginAt = Date.now();

        this.authService.login(credentials).subscribe({
            next: (response) => {
                void this.completeLogin(response);
            },

            error: (error: HttpErrorResponse | TimeoutError) => {
                this.loading = false;

                void CoreAlerts.showError(
                    this.messageForAuthError(error),
                );
            },
        });
    }

    /**
     * Autentica utilizando a biometria do aparelho.
     */
    async loginWithBiometrics(): Promise<void> {
        if (this.loading || !this.biometricEnabled) {
            return;
        }

        this.loading = true;

        try {
            const refreshToken = await this.biometricService.authenticate();

            const response = await firstValueFrom(
                this.authService.refresh(refreshToken),
            );

            this.authService.saveToken(response.access_token);

            this.authService.openMobileMoodle('/painel');
        } catch (error) {
            if (
                error instanceof HttpErrorResponse &&
                error.status === 401
            ) {
                this.biometricService.disable();
                this.biometricEnabled = false;

                void CoreAlerts.showError(
                    Translate.instant('ifrn.login.biometricexpired'),
                );
            } else {
                void CoreAlerts.showError(
                    Translate.instant('ifrn.login.biometricfailed'),
                );
            }
        } finally {
            this.loading = false;
        }
    }

    /**
     * Salva os tokens do SUAP e abre o painel Mobile Moodle.
     *
     * @param response Tokens retornados por POST /api/token/pair.
     */
    private async completeLogin(
        response: AuthResponse,
    ): Promise<void> {
        try {
            this.authService.saveToken(
                response.access_token,
            );
            this.authService.saveUsername(
                response.username || this.username,
            );

            this.password = '';

            await this.offerBiometricActivation(
                response.refresh_token,
            );

            this.authService.openMobileMoodle('/painel');
        } catch (error) {
            void CoreAlerts.showError(
                error,
                {
                    default: 'Não foi possível concluir o login.',
                },
            );
        } finally {
            this.loading = false;
        }
    }

    /**
     * Oferece ou atualiza a credencial biométrica
     * depois do login por senha.
     */
    private async offerBiometricActivation(
        refreshToken: string,
    ): Promise<void> {
        if (!this.biometricAvailable) {
            return;
        }

        let shouldEnable = this.biometricEnabled;

        if (!shouldEnable) {
            try {
                await CoreAlerts.confirm(
                    Translate.instant('ifrn.login.usebiometric'),
                    {
                        header: Translate.instant('ifrn.login.activatebiometric'),
                        okText: Translate.instant('ifrn.login.activate'),
                        cancelText: Translate.instant('ifrn.login.later'),
                    },
                );

                shouldEnable = true;
            } catch {
                return;
            }
        }

        try {
            await this.biometricService.enable(
                refreshToken,
            );

            this.biometricEnabled = true;
        } catch {
            void CoreAlerts.showError(
                Translate.instant('ifrn.login.biometricactivationfailed'),
            );
        }
    }

    /**
     * Login Gov.br depende de integração OAuth no backend.
     */
    loginWithGovBr(): void {
        if (this.loading) {
            return;
        }

        void CoreAlerts.showError(
            Translate.instant('ifrn.login.govbrunavailable'),
        );
    }

    /**
     * Limpa as credenciais informadas.
     */
    clear(): void {
        this.username = '';
        this.password = '';
    }

    /**
     * Abre o SUAP para recuperação de senha (mesmo portal do IFRN-id).
     */
    forgotPassword(event: Event): void {
        event.preventDefault();

        window.open(
            'https://suap.ifrn.edu.br/',
            '_blank',
            'noopener,noreferrer',
        );
    }

    /**
     * Exibe a ajuda de acesso.
     */
    help(event: Event): void {
        event.preventDefault();

        window.open(
            'https://ajuda.ead.ifrn.edu.br/',
            '_blank',
            'noopener,noreferrer',
        );
    }

    /**
     * Converte erros da API do SUAP em mensagens amigáveis.
     */
    private messageForAuthError(
        error: HttpErrorResponse | TimeoutError,
    ): string {
        if (
            error instanceof TimeoutError ||
            (
                error instanceof HttpErrorResponse &&
                error.status === 0 &&
                error.message?.includes('Timeout')
            )
        ) {
            return 'A autenticação demorou demais. Tente novamente.';
        }

        if (!(error instanceof HttpErrorResponse)) {
            return 'Não foi possível conectar ao SUAP.';
        }

        if (error.status === 0) {
            return 'Não foi possível alcançar o SUAP. Verifique sua conexão com a internet.';
        }

        if (error.status === 400 || error.status === 401) {
            return 'IFRN-id ou senha inválidos. Use as mesmas credenciais do SUAP.';
        }

        if (error.status === 429) {
            return Translate.instant('ifrn.login.toomanyattempts');
        }

        if (error.status >= 500) {
            return 'O SUAP está indisponível no momento. Tente novamente em instantes.';
        }

        return 'Não foi possível autenticar no SUAP. Tente novamente.';
    }
}
