import { Injectable } from '@angular/core';
import { CoreLoginHelper } from '@features/login/services/login-helper';
import { CoreSiteIdentityProvider } from '@classes/sites/unauthenticated-site';
import { CoreRedirectPayload } from '@services/navigator';

/** Mantém a abertura e o retorno SSO sob responsabilidade do núcleo Moodle. */
@Injectable({ providedIn: 'root' })
export class SuapBrowserService {
    private cancelCurrent?: () => void;

    cancel(): void {
        this.cancelCurrent?.();
    }

    /** Limita etapas de preparação e permite cancelar antes de abrir o navegador. */
    async waitFor<T>(request: Promise<T>, timeoutMs: number, message: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let settled = false;
            const finish = (error?: Error, value?: T): void => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timer);
                if (this.cancelCurrent === cancel) this.cancelCurrent = undefined;
                if (error) reject(error); else resolve(value as T);
            };
            const cancel = (): void => finish(new Error('Autenticação cancelada.'));
            const timer = window.setTimeout(() => finish(new Error(message)), timeoutMs);
            this.cancelCurrent = cancel;
            request.then(value => finish(undefined, value), error => finish(error instanceof Error ? error : new Error(message)));
        });
    }

    async login(
        siteUrl: string,
        provider: CoreSiteIdentityProvider,
        launchUrl: string | undefined,
        redirect: CoreRedirectPayload,
    ): Promise<boolean> {
        // Mesmo caminho usado antes da tentativa de ocultar o navegador.
        // Não interceptar loaderror, duplicar o handler de callback nem impor
        // prazo à autenticação no navegador. O núcleo valida o retorno SSO.
        return CoreLoginHelper.openBrowserForOAuthLogin(siteUrl, provider, launchUrl, redirect);
    }
}
