import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuthResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

@Injectable({
    providedIn: 'root',
})
export class AuthService {

    private apiUrl = 'http://localhost:8000';

    constructor(
        private http: HttpClient,
    ) {}

    login(credentials: {
        username: string;
        password: string;
    }): Observable<AuthResponse> {

        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        });

        return this.http.post<AuthResponse>(
            `${this.apiUrl}/auth/login`,
            credentials,
            { headers },
        );
    }

    saveToken(token: string): void {
        localStorage.setItem('access_token', token);
    }

    saveRefreshToken(refreshToken: string): void {
        localStorage.setItem('refresh_token', refreshToken);
    }

    getToken(): string | null {
        return localStorage.getItem('access_token');
    }

    getRefreshToken(): string | null {
        return localStorage.getItem('refresh_token');
    }

    isAuthenticated(): boolean {
        return !!this.getToken();
    }

    logout(): void {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    }

}
