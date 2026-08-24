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
import { Component, inject, OnInit } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import { AuthResponse, AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { BiometricService } from '@/MoodleIFRN/services_mobile/biometric.service';
import { CoreAlerts } from '@services/overlays/alerts';
import { CorePlatform } from '@services/platform';
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

    username = '';
    password = '';
    showPassword = false;
    loading = false;
    biometricAvailable = false;
    biometricEnabled = false;

    private lastLoginAt = 0;

    async ngOnInit(): Promise<void> {
        await CorePlatform.ready();

        this.biometricAvailable = await this.biometricService.isAvailable();
        this.biometricEnabled = this.biometricAvailable && this.biometricService.isEnabled();
    }

    /**
     * Alterna a visualizacao da senha.
     */
    togglePassword(): void {
        this.showPassword = !this.showPassword;
    }

    /**
     * Autentica as credenciais na FastAPI.
     */
    login(): void {
        if (this.loading) {
            return;
        }

        if (Date.now() - this.lastLoginAt < 800) {
            return;
        }

        const username = this.username.trim().replace(/[\u0000-\u001F\u007F]/g, '');

        if (!username || !this.password) {
            void CoreAlerts.showError('Por favor, preencha todos os campos.');

            return;
        }

        if (username.length > 120 || this.password.length > 200) {
            void CoreAlerts.showError('Credenciais inválidas.');

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

                void CoreAlerts.showError(this.messageForAuthError(error));
            },
        });
    }

    /** Autentica com a credencial protegida pela biometria do aparelho. */
    async loginWithBiometrics(): Promise<void> {
        if (this.loading || !this.biometricEnabled) {
            return;
        }

        this.loading = true;

        try {
            const refreshToken = await this.biometricService.authenticate();
            const response = await firstValueFrom(this.authService.refresh(refreshToken));

            this.authService.saveToken(response.access_token);
            this.authService.openMobileMoodle('/painel');
        } catch (error) {
            if (error instanceof HttpErrorResponse && error.status === 401) {
                this.biometricService.disable();
                this.biometricEnabled = false;

                void CoreAlerts.showError(
                    'Sua sessão biométrica expirou. Entre com IFRN-id e senha para ativá-la novamente.',
                );
            } else {
                void CoreAlerts.showError(
                    'Não foi possível autenticar com a biometria. Tente novamente ou use sua senha.',
                );
            }
        } finally {
            this.loading = false;
        }
    }

    /**
     * Salva os tokens e abre o painel Mobile Moodle.
     *
     * @param response Tokens retornados pela FastAPI.
     */
    private async completeLogin(response: AuthResponse): Promise<void> {
        try {
            this.authService.saveToken(response.access_token);
            this.password = '';

            await this.offerBiometricActivation(response.refresh_token);
            this.authService.openMobileMoodle('/painel');
        } catch (error) {
            void CoreAlerts.showError(
                error,
                { default: 'N\u00e3o foi poss\u00edvel concluir o login.' },
            );
        } finally {
            this.loading = false;
        }
    }

    /** Oferece ou atualiza a credencial biométrica depois do login por senha. */
    private async offerBiometricActivation(refreshToken: string): Promise<void> {
        if (!this.biometricAvailable) {
            return;
        }

        let shouldEnable = this.biometricEnabled;

        if (!shouldEnable) {
            try {
                await CoreAlerts.confirm(
                    'Deseja usar a biometria nos próximos acessos?',
                    {
                        header: 'Ativar biometria',
                        okText: 'Ativar',
                        cancelText: 'Agora não',
                    },
                );
                shouldEnable = true;
            } catch {
                return;
            }
        }

        try {
            await this.biometricService.enable(refreshToken);
            this.biometricEnabled = true;
        } catch {
            void CoreAlerts.showError(
                'O login foi concluído, mas não foi possível ativar a biometria.',
            );
        }
    }

    /**
     * Login Gov.br depende de integração OAuth no backend.
     * No app, orientamos o uso do IFRN-id até a integração oficial.
     */
    loginWithGovBr(): void {
        if (this.loading) {
            return;
        }

        void CoreAlerts.showError(
            'O acesso com Gov.br será liberado quando a integração oficial estiver ativa. Por enquanto, use IFRN-id e senha.',
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
     * Informa como recuperar a senha.
     *
     * @param event Evento de clique.
     */
    forgotPassword(event: Event): void {
        event.preventDefault();
        void CoreAlerts.showError(
            'A recuperação de senha é feita no SUAP/IFRN-id. Acesse o portal institucional pelo navegador.',
        );
    }

    /**
     * Exibe a ajuda de acesso.
     *
     * @param event Evento de clique.
     */
    help(event: Event): void {
        event.preventDefault();
        window.open('https://ajuda.ead.ifrn.edu.br/', '_blank', 'noopener,noreferrer');
    }

    private messageForAuthError(error: HttpErrorResponse | TimeoutError): string {
        if (error instanceof TimeoutError || (error instanceof HttpErrorResponse && error.status === 0 && error.message?.includes('Timeout'))) {
            return 'A autenticação demorou demais. Tente novamente.';
        }

        if (!(error instanceof HttpErrorResponse)) {
            return 'Não foi possível conectar ao serviço de autenticação.';
        }

        if (error.status === 0) {
            return 'O serviço de autenticação está offline. Inicie a FastAPI na porta 8000.';
        }

        if (error.status === 401) {
            return 'Usuário ou senha inválidos.';
        }

        if (error.status === 429) {
            return 'Muitas tentativas. Aguarde um momento e tente de novo.';
        }

        if (error.status >= 500) {
            return 'Serviço de autenticação indisponível. Tente novamente em instantes.';
        }

        return 'Não foi possível conectar ao serviço de autenticação.';
    }

}
