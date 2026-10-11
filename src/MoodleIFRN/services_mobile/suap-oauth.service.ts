import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CoreOpener } from '@static/opener';
import { firstValueFrom, Subscription, timeout } from 'rxjs';
import { SUAP_OAUTH_CONFIG } from './suap-oauth.config';
import { profileIdentity } from '../mobilemoodle/core_mobile/oauth-profile';

interface ProfileResponse {
    profile: Record<string, unknown>;
    expires_in: number;
}

/** Ponte experimental: segredo e tokens ficam no backend; app recebe o perfil. */
@Injectable({ providedIn: 'root' })
export class SuapOAuthService {
    private readonly http = new HttpClient(inject(HttpBackend));

    get enabled(): boolean {
        return SUAP_OAUTH_CONFIG.enabled && !!this.baseUrl();
    }

    async login(): Promise<ProfileResponse> {
        const base = this.baseUrl();
        if (!base || !this.enabled || !globalThis.crypto?.subtle || !('cordova' in window)) {
            throw new Error('O teste OAuth precisa do aplicativo instalado e do backend configurado.');
        }
        const state = this.random();
        const verifier = this.random();
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
        const url = new URL('/mobile/start', base);
        url.searchParams.set('state', state);
        url.searchParams.set('challenge', this.base64(new Uint8Array(digest)));
        const ticket = await this.authorize(url.toString(), base, state);

        try {
            const result = await firstValueFrom(this.http.post<ProfileResponse>(`${base}/mobile/exchange`, {
                ticket, state, verifier,
            }).pipe(timeout(20000)));
            if (!result?.profile || typeof result.profile !== 'object' || Array.isArray(result.profile)
                    || !profileIdentity(result.profile) || !Number.isFinite(result.expires_in)
                    || result.expires_in <= 0) {
                throw new Error();
            }

            return result;
        } catch {
            throw new Error('Não foi possível receber o perfil do SUAP. Confira o backend e tente novamente.');
        }
    }

    private authorize(url: string, base: string, state: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Uma tentativa nova inicia um unico cookie jar limpo, inclusive Painel.
            // Depois, PainelAvaService deve usar reuseSession:true para manter este SUAP.
            const browser = CoreOpener.openInApp(url, {
                location: 'yes', hidden: 'no', clearcache: 'yes', clearsessioncache: 'yes',
            });
            const subscriptions = new Subscription();
            let finished = false;
            const timer = window.setTimeout(() => finish(undefined, 'O login demorou demais. Tente novamente.'), 180000);
            const finish = (ticket?: string, error?: string): void => {
                if (finished) {
                    return;
                }
                finished = true;
                window.clearTimeout(timer);
                subscriptions.unsubscribe();
                if (ticket) {
                    // Aguarda o fechamento nativo antes de abrir o navegador do Painel.
                    const closeTimer = window.setTimeout(() => {
                        closed.unsubscribe();
                        reject(new Error('Não foi possível retornar ao app. Feche o navegador e tente novamente.'));
                    }, 4000);
                    const closed = browser.on('exit').subscribe(() => {
                        window.clearTimeout(closeTimer);
                        closed.unsubscribe();
                        resolve(ticket);
                    });
                    browser.close();
                } else {
                    browser.close();
                    reject(new Error(error || 'A autenticação foi cancelada.'));
                }
            };
            const inspect = (address: string): void => {
                if (finished) {
                    return;
                }
                let callback: URL;
                try {
                    callback = new URL(address);
                } catch {
                    return;
                }
                if (callback.origin !== base || callback.pathname !== '/mobile/complete') {
                    return;
                }
                const ticket = callback.searchParams.get('ticket') || '';
                if (callback.searchParams.getAll('ticket').length !== 1
                        || callback.searchParams.getAll('state').length !== 1
                        || callback.searchParams.get('state') !== state || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) {
                    finish(undefined, 'Não foi possível confirmar o retorno do SUAP. Tente novamente.');
                    return;
                }
                finish(ticket);
            };
            subscriptions.add(browser.on('loadstart').subscribe(event => inspect(event.url || '')));
            subscriptions.add(browser.on('loadstop').subscribe(event => inspect(event.url || '')));
            subscriptions.add(browser.on('exit').subscribe(() => finish()));
            subscriptions.add(browser.on('loaderror').subscribe(() => {
                finish(undefined, 'Não foi possível abrir o login. Confira a conexão e o túnel do backend.');
            }));
        });
    }

    private baseUrl(): string | null {
        try {
            const url = new URL(SUAP_OAUTH_CONFIG.brokerBaseUrl);

            return url.protocol === 'https:' && !url.username && !url.password
                && url.pathname === '/' && !url.search && !url.hash ? url.origin : null;
        } catch {
            return null;
        }
    }

    private random(): string {
        return this.base64(crypto.getRandomValues(new Uint8Array(32)));
    }

    private base64(bytes: Uint8Array): string {
        return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
}
