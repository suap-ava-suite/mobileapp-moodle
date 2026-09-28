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

import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthResponse } from './auth.service';
import { GOVBR_AUTH_CONFIG } from './govbr-auth.config';

const STATE_KEY = 'ifrn_govbr_oauth_state';
const VERIFIER_KEY = 'ifrn_govbr_pkce_verifier';
const RETURN_URL_KEY = 'ifrn_govbr_return_url';
const REQUEST_TIMEOUT_MS = 20000;
const MAX_CALLBACK_VALUE_LENGTH = 2048;
const JWT_SHAPE = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;

/* eslint-disable @typescript-eslint/naming-convention */
interface GovBrTokenResponse {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    username?: string;
    access?: string;
    refresh?: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

/** Erro seguro para ser exibido na tela de login. */
export class GovBrAuthError extends Error {

    constructor(message: string) {
        super(message);
        this.name = 'GovBrAuthError';
    }

}

/**
 * Fluxo GOV.BR do aplicativo.
 *
 * O app usa Authorization Code + PKCE, mas a comunicação com o GOV.BR e a
 * conversão da identidade (CPF) em usuário/tokens SUAP pertencem ao backend.
 * Assim, nenhum client_secret ou token GOV.BR fica embutido no APK.
 */
@Injectable({
    providedIn: 'root',
})
export class GovBrAuthService {

    private readonly http = new HttpClient(inject(HttpBackend));

    isIntegratedLoginConfigured(): boolean {
        return this.getBrokerBaseUrl() !== null;
    }

    /**
     * Inicia o login integrado. Se ainda não houver broker configurado, abre
     * o acesso GOV.BR oficial do SUAP para o aluno consultar sua conta.
     *
     * @returns true quando iniciou o fluxo integrado; false no modo consulta.
     */
    async startLogin(): Promise<boolean> {
        const brokerBaseUrl = this.getBrokerBaseUrl();

        if (!brokerBaseUrl) {
            window.open(
                GOVBR_AUTH_CONFIG.suapGovBrUrl,
                '_blank',
                'noopener,noreferrer',
            );

            return false;
        }

        if (!globalThis.crypto?.subtle) {
            throw new GovBrAuthError(
                'Este dispositivo não oferece os recursos de segurança necessários para entrar com GOV.BR.',
            );
        }

        const state = this.randomUrlSafeValue(32);
        const verifier = this.randomUrlSafeValue(64);
        const challenge = await this.createPkceChallenge(verifier);
        const returnUrl = this.createReturnUrl();

        sessionStorage.setItem(STATE_KEY, state);
        sessionStorage.setItem(VERIFIER_KEY, verifier);
        sessionStorage.setItem(RETURN_URL_KEY, returnUrl);

        const authorizeUrl = new URL(GOVBR_AUTH_CONFIG.authorizePath, `${brokerBaseUrl}/`);
        authorizeUrl.searchParams.set('return_uri', returnUrl);
        authorizeUrl.searchParams.set('state', state);
        authorizeUrl.searchParams.set('code_challenge', challenge);
        authorizeUrl.searchParams.set('code_challenge_method', 'S256');

        window.location.assign(authorizeUrl.toString());

        return true;
    }

    /**
     * Processa o retorno do broker e troca o código descartável por JWTs SUAP.
     * Retorna null quando a página não foi aberta como callback GOV.BR.
     */
    async finishLoginFromCallback(): Promise<AuthResponse | null> {
        const params = new URLSearchParams(window.location.search);
        const isCallback = params.has('govbr_code') ||
            params.has('govbr_error') ||
            params.has('govbr_state');

        if (!isCallback) {
            return null;
        }

        const code = this.readCallbackValue(params, 'govbr_code');
        const returnedState = this.readCallbackValue(params, 'govbr_state');
        const providerError = this.readCallbackValue(params, 'govbr_error');
        const expectedState = sessionStorage.getItem(STATE_KEY) || '';
        const verifier = sessionStorage.getItem(VERIFIER_KEY) || '';
        const returnUrl = sessionStorage.getItem(RETURN_URL_KEY) || '';

        this.cleanCallbackUrl();

        if (providerError) {
            this.clearTemporaryData();
            throw new GovBrAuthError(this.messageForProviderError(providerError));
        }

        if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
            this.clearTemporaryData();
            throw new GovBrAuthError(
                'O retorno do GOV.BR não pode ser confirmado. Inicie o acesso novamente.',
            );
        }

        if (!verifier || !returnUrl) {
            this.clearTemporaryData();
            throw new GovBrAuthError(
                'A sessão de acesso GOV.BR expirou. Inicie o acesso novamente.',
            );
        }

        const brokerBaseUrl = this.getBrokerBaseUrl();
        if (!brokerBaseUrl) {
            this.clearTemporaryData();
            throw new GovBrAuthError(
                'O acesso integrado GOV.BR ainda não foi configurado pelo IFRN.',
            );
        }

        try {
            const response = await firstValueFrom(
                this.http.post<GovBrTokenResponse>(
                    new URL(GOVBR_AUTH_CONFIG.exchangePath, `${brokerBaseUrl}/`).toString(),
                    {
                        code,
                        state: returnedState,
                        code_verifier: verifier,
                        return_uri: returnUrl,
                    },
                    {
                        headers: new HttpHeaders()
                            .set('Content-Type', 'application/json')
                            .set('Accept', 'application/json'),
                    },
                ).pipe(timeout(REQUEST_TIMEOUT_MS)),
            );

            return this.toAuthResponse(response);
        } finally {
            this.clearTemporaryData();
        }
    }

    private getBrokerBaseUrl(): string | null {
        const value = GOVBR_AUTH_CONFIG.brokerBaseUrl.trim().replace(/\/+$/, '');

        if (!value) {
            return null;
        }

        try {
            const url = new URL(value);

            return url.protocol === 'https:'
                ? url.origin + url.pathname.replace(/\/$/, '')
                : null;
        } catch {
            return null;
        }
    }

    private createReturnUrl(): string {
        const url = new URL(window.location.href);

        url.searchParams.delete('govbr_code');
        url.searchParams.delete('govbr_state');
        url.searchParams.delete('govbr_error');

        return url.toString();
    }

    private cleanCallbackUrl(): void {
        const url = new URL(window.location.href);

        url.searchParams.delete('govbr_code');
        url.searchParams.delete('govbr_state');
        url.searchParams.delete('govbr_error');
        window.history.replaceState({}, document.title, url.toString());
    }

    private clearTemporaryData(): void {
        sessionStorage.removeItem(STATE_KEY);
        sessionStorage.removeItem(VERIFIER_KEY);
        sessionStorage.removeItem(RETURN_URL_KEY);
    }

    private readCallbackValue(params: URLSearchParams, name: string): string {
        const value = (params.get(name) || '').trim();

        return value.length <= MAX_CALLBACK_VALUE_LENGTH ? value : '';
    }

    private toAuthResponse(response: GovBrTokenResponse): AuthResponse {
        const access = response?.access_token || response?.access || '';
        const refresh = response?.refresh_token || response?.refresh || '';

        if (!JWT_SHAPE.test(access) || !JWT_SHAPE.test(refresh)) {
            throw new GovBrAuthError(
                'O SUAP não retornou uma sessão válida para este usuário.',
            );
        }

        return {
            access_token: access,
            refresh_token: refresh,
            token_type: response.token_type || 'bearer',
            username: response.username,
        };
    }

    private messageForProviderError(error: string): string {
        if (error === 'access_denied' || error === 'cancelled') {
            return 'O acesso pelo GOV.BR foi cancelado.';
        }

        if (error === 'account_not_linked') {
            return 'Seu CPF foi autenticado, mas não está vinculado a uma conta ativa no SUAP.';
        }

        return 'Não foi possível concluir o acesso pelo GOV.BR. Tente novamente.';
    }

    private randomUrlSafeValue(byteLength: number): string {
        const bytes = new Uint8Array(byteLength);
        globalThis.crypto.getRandomValues(bytes);

        return this.toBase64Url(bytes);
    }

    private async createPkceChallenge(verifier: string): Promise<string> {
        const digest = await globalThis.crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(verifier),
        );

        return this.toBase64Url(new Uint8Array(digest));
    }

    private toBase64Url(bytes: Uint8Array): string {
        let binary = '';

        for (const byte of bytes) {
            binary += String.fromCharCode(byte);
        }

        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

}
