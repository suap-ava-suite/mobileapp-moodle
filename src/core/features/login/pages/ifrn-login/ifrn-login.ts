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
import { Component, inject } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import { AuthResponse, AuthService } from '@/core/services_mobile/auth.service';
import { CoreNavigator } from '@services/navigator';
import { CoreAlerts } from '@services/overlays/alerts';

@Component({
    selector: 'page-ifrn-login',
    templateUrl: './ifrn-login.html',
    styleUrls: ['./ifrn-login.scss'],
    imports: [
        CoreSharedModule,
    ],
})
export class IfrnLoginPage {

    private readonly authService = inject(AuthService);

    username = '';
    password = '';
    showPassword = false;
    loading = false;

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

        if (!this.username.trim() || !this.password) {
            void CoreAlerts.showError('Por favor, preencha todos os campos.');

            return;
        }

        const credentials = {
            username: this.username.trim(),
            password: this.password,
        };

        this.loading = true;

        this.authService.login(credentials).subscribe({
            next: (response) => {
                void this.completeLogin(response);
            },
            error: (error: HttpErrorResponse) => {
                this.loading = false;

                void CoreAlerts.showError(
                    error.status === 0
                        ? 'O servi\u00e7o de autentica\u00e7\u00e3o est\u00e1 offline. Inicie a FastAPI na porta 8000.'
                        : error.status === 401
                            ? 'Usu\u00e1rio ou senha inv\u00e1lidos.'
                            : 'N\u00e3o foi poss\u00edvel conectar ao servi\u00e7o de autentica\u00e7\u00e3o.',
                );
            },
        });
    }

    /**
     * Salva os tokens retornados pela FastAPI e abre a pagina Hello World.
     *
     * @param response Tokens retornados pela FastAPI.
     */
    private async completeLogin(response: AuthResponse): Promise<void> {
        try {
            this.authService.saveToken(response.access_token);
            this.authService.saveRefreshToken(response.refresh_token);

            await CoreNavigator.navigate('/hello-world', { reset: true });
        } catch (error) {
            void CoreAlerts.showError(
                error,
                { default: 'N\u00e3o foi poss\u00edvel concluir o login.' },
            );
        } finally {
            this.loading = false;
        }
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
    }

    /**
     * Exibe a ajuda de acesso.
     *
     * @param event Evento de clique.
     */
    help(event: Event): void {
        event.preventDefault();
    }

}
