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
import { Observable } from 'rxjs';

/* eslint-disable @typescript-eslint/naming-convention */
export interface AuthResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

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
            credentials,
            { headers },
        );
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
        );
    }

    /**
     * Mantém o access token apenas em memória durante a sessão do aplicativo.
     */
    saveToken(token: string): void {
        this.accessToken = token;
    }

    /**
     * Retorna o Access Token.
     */
    getToken(): string | null {
        return this.accessToken;
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
    }

}
