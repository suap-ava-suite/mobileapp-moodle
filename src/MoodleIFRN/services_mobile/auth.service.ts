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
import { Observable, map, timeout } from 'rxjs';

/* eslint-disable @typescript-eslint/naming-convention */
export interface AuthResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    username?: string;
}

/**
 * Resposta do SimpleJWT do SUAP (`POST /api/token/pair`).
 * Schema oficial: TokenObtainPairOutputSchema em
 * https://suap.ifrn.edu.br/api/openapi.json
 */
interface SuapTokenPairResponse {
    access: string;
    refresh: string;
    username: string;
}

/** Resposta do SimpleJWT do SUAP (`POST /api/token/refresh`). */
interface SuapTokenRefreshResponse {
    access: string | null;
    refresh: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

const REQUEST_TIMEOUT_MS = 15000;
const TOKEN_KEY = 'ifrn_access_token';
const USERNAME_KEY = 'ifrn_username';
const JWT_SHAPE = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;
const MAX_TOKEN_LENGTH = 4096;

/**
 * API oficial do SUAP (IFRN).
 * Docs: https://suap.ifrn.edu.br/api/docs/
 * OpenAPI: https://suap.ifrn.edu.br/api/openapi.json
 *
 * O repositório público antigo `IFRN/suap` não está disponível;
 * a fonte de verdade é a API em produção acima.
 */
const SUAP_API_URL = 'https://suap.ifrn.edu.br';

function jsonHeaders(): HttpHeaders {
    return new HttpHeaders()
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');
}

function readJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const part = token.split('.')[1];
        const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        const json = atob(padded);

        return JSON.parse(json) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function isValidAccessToken(token: string): boolean {
    if (!JWT_SHAPE.test(token) || token.length >= MAX_TOKEN_LENGTH) {
        return false;
    }

    const payload = readJwtPayload(token);

    if (!payload) {
        return false;
    }

    const exp = payload['exp'];

    if (typeof exp === 'number' && exp * 1000 <= Date.now()) {
        return false;
    }

    return true;
}

function toAuthResponse(pair: SuapTokenPairResponse): AuthResponse {
    if (!pair?.access || !pair?.refresh) {
        throw new Error('Resposta inválida do SUAP: tokens ausentes.');
    }

    if (!isValidAccessToken(pair.access)) {
        throw new Error('Resposta inválida do SUAP: access token inválido.');
    }

    return {
        access_token: pair.access,
        refresh_token: pair.refresh,
        token_type: 'bearer',
        username: pair.username,
    };
}

@Injectable({
    providedIn: 'root',
})
export class AuthService {

    private readonly http = new HttpClient(inject(HttpBackend));

    private readonly apiUrl = SUAP_API_URL;
    private accessToken: string | null = null;

    /**
     * Autentica com matrícula/CPF (IFRN-id) e senha do SUAP.
     * Endpoint oficial: POST /api/token/pair
     * Body: { username, password }
     */
    login(credentials: {
        username: string;
        password: string;
    }): Observable<AuthResponse> {
        return this.http.post<SuapTokenPairResponse>(
            `${this.apiUrl}/api/token/pair`,
            {
                username: credentials.username.trim(),
                password: credentials.password,
            },
            { headers: jsonHeaders() },
        ).pipe(
            map((response) => toAuthResponse(response)),
            timeout(REQUEST_TIMEOUT_MS),
        );
    }

    /**
     * Renova a sessão com o refresh token do SUAP (ex.: após biometria).
     * Endpoint oficial: POST /api/token/refresh
     * Body: { refresh }
     */
    refresh(refreshToken: string): Observable<AuthResponse> {
        return this.http.post<SuapTokenRefreshResponse>(
            `${this.apiUrl}/api/token/refresh`,
            { refresh: refreshToken },
            { headers: jsonHeaders() },
        ).pipe(
            map((response) => {
                if (!response?.access) {
                    throw new Error('Refresh do SUAP não retornou access token.');
                }

                if (!isValidAccessToken(response.access)) {
                    throw new Error('Refresh do SUAP retornou access token inválido.');
                }

                return {
                    access_token: response.access,
                    refresh_token: response.refresh || refreshToken,
                    token_type: 'bearer',
                };
            }),
            timeout(REQUEST_TIMEOUT_MS),
        );
    }

    /**
     * Confere se o access token ainda é aceito pelo SUAP.
     * Endpoint oficial: POST /api/token/verify
     */
    verify(accessToken: string): Observable<boolean> {
        return this.http.post(
            `${this.apiUrl}/api/token/verify`,
            { token: accessToken },
            { headers: jsonHeaders() },
        ).pipe(
            map(() => true),
            timeout(REQUEST_TIMEOUT_MS),
        );
    }

    /**
     * Mantém o access token em memória e no sessionStorage do WebView.
     */
    saveToken(token: string): void {
        if (!isValidAccessToken(token)) {
            this.logout();

            return;
        }

        this.accessToken = token;
        sessionStorage.setItem(TOKEN_KEY, token);
    }

    /**
     * Guarda o usuário autenticado (matrícula/CPF) para o painel.
     */
    saveUsername(username: string | undefined): void {
        const value = (username || '').trim();

        if (!value) {
            sessionStorage.removeItem(USERNAME_KEY);

            return;
        }

        sessionStorage.setItem(USERNAME_KEY, value);
    }

    getUsername(): string | null {
        return sessionStorage.getItem(USERNAME_KEY);
    }

    /**
     * Retorna o Access Token.
     */
    getToken(): string | null {
        if (this.accessToken && isValidAccessToken(this.accessToken)) {
            return this.accessToken;
        }

        const stored = sessionStorage.getItem(TOKEN_KEY);

        if (stored && isValidAccessToken(stored)) {
            this.accessToken = stored;

            return stored;
        }

        this.accessToken = null;
        sessionStorage.removeItem(TOKEN_KEY);

        return null;
    }

    /**
     * Verifica se existe um usuário autenticado.
     */
    isAuthenticated(): boolean {
        return this.getToken() !== null;
    }

    /**
     * Retorna os headers de autenticação.
     */
    getAuthHeaders(): HttpHeaders {
        const token = this.getToken();

        return jsonHeaders().set(
            'Authorization',
            token ? `Bearer ${token}` : '',
        );
    }

    /**
     * Remove os tokens salvos.
     */
    logout(): void {
        this.accessToken = null;
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USERNAME_KEY);
    }

    /**
     * Abre o painel Mobile Moodle.
     * Token fica só no sessionStorage (mesma origem) — não vai na URL.
     */
    openMobileMoodle(hash = '/painel'): void {
        const token = this.getToken();

        if (!token) {
            return;
        }

        sessionStorage.setItem(TOKEN_KEY, token);

        const targetHash = hash.startsWith('#')
            ? hash
            : `#${hash.startsWith('/') ? hash : `/${hash}`}`;
        const base = document.querySelector('base')?.getAttribute('href') || '/';
        const root = base.endsWith('/') ? base : `${base}/`;
        const url = new URL(`${root}mobilemoodle/index.html`, window.location.origin);

        url.hash = targetHash.replace(/^#/, '');

        window.location.assign(url.toString());
    }

}
