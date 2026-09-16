
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
import {
    GovBrAuthError,
    GovBrAuthService,
} from '@/MoodleIFRN/services_mobile/govbr-auth.service';
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
    private readonly govBrAuthService = inject(GovBrAuthService);
    private readonly router = inject(Router);

    username = '';
    password = '';

    showPassword = false;
    loading = false;

    /** Mensagem curta de status (sessão / biometria / login). */
    statusMessage = '';

    /** Erro de validação ou autenticação (inline, mobile-friendly). */
    formError = '';

    /** Orientação exibida quando o GOV.BR abre o SUAP em modo consulta. */
    govBrNotice = '';

    biometricAvailable = false;
    biometricEnabled = false;
    govBrIntegrated = false;

    canGoBack = true;

    private lastLoginAt = 0;

    /**
     * Volta para a página inicial IFRN (marketplace).
     */
    goBack(): void {
        if (this.loading) {
            return;
        }

        void this.router.navigate(['/login/marketplace-ifrn']);
    }

    /**
     * Enter no IFRN-id → foca o campo senha (teclado mobile).
     */
    onUsernameEnter(event: Event): void {
        event.preventDefault();

        const passwordInput = document.getElementById(
            'ifrn-login-password',
        ) as HTMLInputElement | null;

        passwordInput?.focus();
    }

    /**
     * Inicializa biometria e tenta retomar a sessão sem pedir senha.
     */
    async ngOnInit(): Promise<void> {
        await CorePlatform.ready();

        this.biometricAvailable = await this.biometricService.isAvailable();
        this.govBrIntegrated = this.govBrAuthService.isIntegratedLoginConfigured();

        this.biometricEnabled =
            this.biometricAvailable &&
            this.biometricService.isEnabled();

        const savedUsername = this.authService.getUsername();
        if (savedUsername) {
            this.username = savedUsername;
        }

        if (await this.handleGovBrCallback()) {
            return;
        }

        await this.resumeSession();
    }

    /**
     * Finaliza o retorno do GOV.BR antes de tentar retomar outra sessão.
     */
    private async handleGovBrCallback(): Promise<boolean> {
        try {
            const response = await this.govBrAuthService.finishLoginFromCallback();

            if (!response) {
                return false;
            }

            this.loading = true;
            this.statusMessage = 'Concluindo acesso pelo GOV.BR…';
            await this.completeLogin(response);

            return true;
        } catch (error) {
            this.loading = false;
            this.statusMessage = '';
            this.showFormError(
                error instanceof GovBrAuthError
                    ? error.message
                    : 'Não foi possível concluir o acesso pelo GOV.BR.',
            );

            return true;
        }
    }

    /**
     * Inicia o acesso GOV.BR. Sem broker IFRN configurado, abre o fluxo
     * oficial do SUAP para o aluno consultar a conta/matrícula.
     */
    async loginWithGovBr(): Promise<void> {
        if (this.loading) {
            return;
        }

        this.formError = '';
        this.govBrNotice = '';
        this.loading = true;
        this.statusMessage = this.govBrIntegrated
            ? 'Abrindo o GOV.BR…'
            : 'Abrindo o acesso oficial do SUAP…';

        try {
            const integrated = await this.govBrAuthService.startLogin();

            if (!integrated) {
                this.statusMessage = '';
                this.govBrNotice =
                    'O SUAP foi aberto no navegador. Entre com GOV.BR para consultar sua conta e matrícula.';
            }
        } catch (error) {
            this.statusMessage = '';
            this.showFormError(
                error instanceof GovBrAuthError
                    ? error.message
                    : 'Não foi possível abrir o acesso GOV.BR.',
            );
        } finally {
            this.loading = false;
        }
    }

    /**
     * 1) Access token válido → painel.
     * 2) Senão, biometria ativa → prompt automático.
     * 3) Senão → formulário de senha.
     */
    private async resumeSession(): Promise<void> {
        if (await this.enterWithValidAccessToken()) {
            return;
        }

        if (this.biometricEnabled) {
            await this.loginWithBiometrics({ auto: true });
        }
    }

    /**
     * Entra no painel se o access token local ainda for válido.
     * Confere no SUAP quando houver rede; offline com token ok também entra.
     *
     * @returns true se navegou para o painel.
     */
    private async enterWithValidAccessToken(): Promise<boolean> {
        const token = this.authService.getToken();

        if (!token) {
            return false;
        }

        this.loading = true;
        this.statusMessage = 'Verificando sessão…';

        try {
            await firstValueFrom(this.authService.verify(token));
            this.authService.openMobileMoodle('/painel');

            return true;
        } catch (error) {
            if (
                error instanceof HttpErrorResponse &&
                error.status === 401
            ) {
                this.authService.logout();
                this.statusMessage = '';

                return false;
            }

            // Rede/SUAP indisponível: exp local ainda ok → segue para o painel.
            this.authService.openMobileMoodle('/painel');

            return true;
        } finally {
            this.loading = false;
        }
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

        this.formError = '';

        const username = this.username
            .trim()
            .replace(/[\u0000-\u001F\u007F]/g, '');

        if (!username || !this.password) {
            this.showFormError('Por favor, preencha todos os campos.');

            return;
        }

        // Limites alinhados ao schema do SUAP (/api/token/pair).
        if (username.length > 150 || this.password.length > 128) {
            this.showFormError('Credenciais inválidas.');

            return;
        }

        const credentials = {
            username,
            password: this.password,
        };

        this.loading = true;
        this.statusMessage = 'Entrando…';
        this.lastLoginAt = Date.now();

        this.authService.login(credentials).subscribe({
            next: (response) => {
                void this.completeLogin(response);
            },

            error: (error: HttpErrorResponse | TimeoutError) => {
                this.loading = false;
                this.statusMessage = '';
                this.showFormError(this.messageForAuthError(error));
            },
        });
    }

    /**
     * Autentica utilizando a biometria do aparelho.
     *
     * @param options.auto Se true (abertura da tela), cancelar/falha fica silencioso.
     */
    async loginWithBiometrics(
        options: { auto?: boolean } = {},
    ): Promise<void> {
        if (this.loading || !this.biometricEnabled) {
            return;
        }

        this.formError = '';
        this.loading = true;
        this.statusMessage = options.auto
            ? 'Aguardando biometria…'
            : 'Entrando…';

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

                this.showFormError(
                    'Sua sessão biométrica expirou. Entre com IFRN-id e senha para ativá-la novamente.',
                );
            } else if (
                error instanceof HttpErrorResponse ||
                error instanceof TimeoutError
            ) {
                this.showFormError(this.messageForAuthError(error));
            } else if (!options.auto) {
                this.showFormError(
                    'Não foi possível autenticar com biometria. Tente novamente ou use a senha.',
                );
            }
        } finally {
            this.loading = false;
            this.statusMessage = '';
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
            this.formError = '';
            this.statusMessage = 'Preparando acesso…';

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
            this.statusMessage = '';
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
                    'Deseja usar biometria nos próximos acessos?',
                    {
                        header: 'Ativar acesso biométrico',
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
            await this.biometricService.enable(
                refreshToken,
            );

            this.biometricEnabled = true;
        } catch {
            void CoreAlerts.showError(
                'Você entrou, mas não foi possível ativar a biometria.',
            );
        }
    }

    /**
     * Limpa as credenciais e o erro do formulário.
     */
    clear(): void {
        this.username = '';
        this.password = '';
        this.formError = '';
        this.govBrNotice = '';
        this.showPassword = false;
    }

    /**
     * Exibe erro inline e foca o primeiro campo útil.
     */
    private showFormError(message: string): void {
        this.formError = message;

        const targetId = this.password
            ? 'ifrn-login-password'
            : 'ifrn-login-username';

        queueMicrotask(() => {
            document.getElementById(targetId)?.focus();
        });
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
            return 'Muitas tentativas. Aguarde um momento e tente novamente.';
        }

        if (error.status >= 500) {
            return 'O SUAP está indisponível no momento. Tente novamente em instantes.';
        }

        return 'Não foi possível autenticar no SUAP. Tente novamente.';
    }
}
