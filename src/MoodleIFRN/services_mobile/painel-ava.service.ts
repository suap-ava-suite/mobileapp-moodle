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

import { PAINEL_AVA_CONFIG } from './painel-ava.config';

/* eslint-disable @typescript-eslint/naming-convention */
/** Resposta de POST /api/v1/authenticate/ (Painel AVA). */
export interface PainelAvaAuthResponse {
    token: string;
    data?: Record<string, unknown>;
}
/* eslint-enable @typescript-eslint/naming-convention */

const REQUEST_TIMEOUT_MS = 15000;
const PAINEL_TOKEN_KEY = 'ifrn_painel_token';
const PAINEL_PROFILE_KEY = 'ifrn_painel_profile';
const JWT_SHAPE = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;
const MAX_TOKEN_LENGTH = 4096;

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

        return JSON.parse(atob(padded)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function isValidPainelToken(token: string): boolean {
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

/**
 * Cliente do Painel AVA.
 *
 * O JWT do Painel NÃO é wstoken Moodle nem o SimpleJWT do SUAP.
 * Serve só para chamar /api/v1/diarios/ (cursos com courseid Moodle).
 */
@Injectable({
    providedIn: 'root',
})
export class PainelAvaService {

    private readonly http = new HttpClient(inject(HttpBackend));

    /**
     * Troca IFRN-id/senha por JWT do Painel (valida no SUAP no servidor).
     * Endpoint: POST /api/v1/authenticate/
     */
    authenticate(credentials: {
        username: string;
        password: string;
    }): Observable<PainelAvaAuthResponse> {
        const url = `${PAINEL_AVA_CONFIG.baseUrl}${PAINEL_AVA_CONFIG.authenticatePath}`;

        return this.http.post<PainelAvaAuthResponse>(
            url,
            {
                username: credentials.username.trim(),
                password: credentials.password,
            },
            { headers: jsonHeaders() },
        ).pipe(
            map((response) => {
                if (!response?.token || !isValidPainelToken(response.token)) {
                    throw new Error('Painel AVA não retornou token válido.');
                }

                return response;
            }),
            timeout(REQUEST_TIMEOUT_MS),
        );
    }

    saveToken(token: string): void {
        if (!isValidPainelToken(token)) {
            this.clearSession();

            return;
        }

        sessionStorage.setItem(PAINEL_TOKEN_KEY, token);
    }

    getToken(): string | null {
        const stored = sessionStorage.getItem(PAINEL_TOKEN_KEY);

        if (stored && isValidPainelToken(stored)) {
            return stored;
        }

        if (stored) {
            sessionStorage.removeItem(PAINEL_TOKEN_KEY);
        }

        return null;
    }

    hasValidToken(): boolean {
        return this.getToken() !== null;
    }

    /**
     * Perfil retornado por /authenticate/ (nome, foto, etc.) para o painel mobile.
     */
    saveProfile(data: Record<string, unknown> | undefined): void {
        if (!data || typeof data !== 'object') {
            sessionStorage.removeItem(PAINEL_PROFILE_KEY);

            return;
        }

        try {
            sessionStorage.setItem(PAINEL_PROFILE_KEY, JSON.stringify(data));
        } catch {
            sessionStorage.removeItem(PAINEL_PROFILE_KEY);
        }
    }

    getProfile(): Record<string, unknown> | null {
        const raw = sessionStorage.getItem(PAINEL_PROFILE_KEY);

        if (!raw) {
            return null;
        }

        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;

            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }

    clearSession(): void {
        sessionStorage.removeItem(PAINEL_TOKEN_KEY);
        sessionStorage.removeItem(PAINEL_PROFILE_KEY);
    }

    /** Chaves usadas também pelo bundle mobilemoodle (mesma origem). */
    static readonly TOKEN_KEY = PAINEL_TOKEN_KEY;
    static readonly PROFILE_KEY = PAINEL_PROFILE_KEY;

}
