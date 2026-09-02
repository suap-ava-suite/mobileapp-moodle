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
import { Observable, timeout } from 'rxjs';

/* eslint-disable @typescript-eslint/naming-convention */
export interface AuthResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

const REQUEST_TIMEOUT_MS = 15000;
const TOKEN_KEY = 'ifrn_access_token';
const JWT_SHAPE = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;
const MAX_TOKEN_LENGTH = 4096;

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

@Injectable({
    providedIn: 'root',
})
export class AuthService {

    private readonly http = new HttpClient(inject(HttpBackend));

    private readonly apiUrl = 'http://localhost:8000';
    private accessToken: string | null = null;

    /**
     * Realiza o login no FastAPI.
     */
    login(credentials: {
        username: string;
        password: string;
    }): Observable<AuthResponse> {
        const headers = new HttpHeaders()
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json');

        return this.http.post<AuthResponse>(
            `${this.apiUrl}/auth/login`,
            {
                username: credentials.username.trim(),
                password: credentials.password,
            },
            { headers },
        ).pipe(timeout(REQUEST_TIMEOUT_MS));
    }

    /**
     * Renova a sessão usando a credencial liberada pela biometria.
     */
    refresh(refreshToken: string): Observable<AuthResponse> {
        /* eslint-disable @typescript-eslint/naming-convention */
        const payload = { refresh_token: refreshToken };
        /* eslint-enable @typescript-eslint/naming-convention */

        return this.http.post<AuthResponse>(
            `${this.apiUrl}/auth/refresh`,
            payload,
            {
                headers: new HttpHeaders()
                    .set('Content-Type', 'application/json')
                    .set('Accept', 'application/json'),
            },
        ).pipe(timeout(REQUEST_TIMEOUT_MS));
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

        return new HttpHeaders()
            .set('Content-Type', 'application/json')
            .set('Accept', 'application/json')
            .set('Authorization', token ? `Bearer ${token}` : '');
    }

    /**
     * Remove os tokens salvos.
     */
    logout(): void {
        this.accessToken = null;
        sessionStorage.removeItem(TOKEN_KEY);
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

        const targetHash = hash.startsWith('#') ? hash : `#${hash.startsWith('/') ? hash : `/${hash}`}`;
        const base = document.querySelector('base')?.getAttribute('href') || '/';
        const root = base.endsWith('/') ? base : `${base}/`;
        const url = new URL(`${root}mobilemoodle/index.html`, window.location.origin);

        url.hash = targetHash.replace(/^#/, '');

        window.location.assign(url.toString());
    }

}
