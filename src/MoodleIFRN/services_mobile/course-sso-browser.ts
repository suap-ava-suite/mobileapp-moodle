import type { InAppBrowserObject } from '@awesome-cordova-plugins/in-app-browser/ngx';

export interface CourseSsoBrowserOptions {
    loginUrl: string;
    launchUrl?: string;
    siteUrl: string;
    open: (url: string) => InAppBrowserObject;
    isToken: (url: string) => boolean;
    acceptToken: (url: string) => Promise<void>;
    timeoutMs?: number;
}

/** Um SSO de curso, sempre oculto; nunca solicita credenciais nem abre outro aplicativo. */
export function startCourseSsoBrowser(options: CourseSsoBrowserOptions): {
    browser: InAppBrowserObject;
    completion: Promise<void>;
    cancel: () => void;
} {
    const siteOrigin = new URL(options.siteUrl).origin;
    const initial = new URL(options.loginUrl);
    const launch = new URL(options.launchUrl || options.loginUrl);
    if ([initial, launch].some(url => url.protocol !== 'https:' || url.origin !== siteOrigin)) {
        throw new Error('Destino de autenticação do curso inválido.');
    }
    const browser = options.open(options.loginUrl);
    const subscriptions: Array<{ unsubscribe: () => void }> = [];
    let settled = false;
    let accepting = false;
    let restoredLaunch = false;
    const visits = new Map<string, number>();
    let cancel = (): void => { /* Definido durante a criação da Promise. */ };
    const completion = new Promise<void>((resolve, reject) => {
        const dispose = (): void => {
            clearTimeout(timer);
            subscriptions.forEach(subscription => subscription.unsubscribe());
            browser.close();
        };
        const fail = (message: string): void => {
            if (settled || accepting) return;
            settled = true;
            dispose();
            reject(new Error(message));
        };
        const timer = setTimeout(() => fail('A conexão automática do curso demorou demais. Tente novamente.'),
            options.timeoutMs ?? 45000);
        cancel = () => fail('Conexão do curso cancelada.');
        const accept = (url: string): boolean => {
            // Alguns redirects do WebView envolvem o scheme em http(s) e removem o ":".
            // Reconhece apenas o callback móvel, antes de permitir qualquer navegação HTTP.
            const callback = url.replace(/^https?:\/\//i, '')
                .replace(/^([a-z][a-z0-9+.-]*)\/\/token=/i, '$1://token=');
            if (!options.isToken(callback)) return false;
            if (settled || accepting) return true;
            accepting = true;
            // Fecha a janela antes de o núcleo navegar; mantém o passport para a validação oficial.
            dispose();
            options.acceptToken(callback).then(() => {
                settled = true;
                resolve();
            }, () => {
                settled = true;
                reject(new Error('Não foi possível validar a conexão automática deste curso.'));
            });
            return true;
        };
        const allowed = (url: string): boolean => {
            try {
                const parsed = new URL(url);
                return parsed.protocol === 'https:' && !parsed.username && !parsed.password
                    && [siteOrigin, 'https://suap.ifrn.edu.br'].includes(parsed.origin);
            } catch { return false; }
        };
        subscriptions.push(browser.on('beforeload').subscribe(event => {
            if (settled || accepting || accept(event.url)) return;
            if (!allowed(event.url)) {
                fail('O ambiente solicitou um destino de autenticação não autorizado.');
                return;
            }
            // Ignora os parâmetros OAuth: um novo code/state não torna um ciclo válido.
            const destination = new URL(event.url);
            const route = destination.origin + destination.pathname;
            const count = (visits.get(route) || 0) + 1;
            visits.set(route, count);
            if (count > 4) {
                fail('O ambiente entrou em um ciclo de autenticação. Não foi possível concluir o acesso automático.');
                return;
            }
            browser._loadAfterBeforeload(event.url);
        }));
        for (const eventName of ['loadstart', 'customscheme']) {
            subscriptions.push(browser.on(eventName).subscribe(event => {
                if (settled || accepting || accept(event.url)) return;
                if (!allowed(event.url)) fail('Destino inesperado na conexão automática do curso.');
            }));
        }
        subscriptions.push(browser.on('loadstop').subscribe(event => {
            if (settled || accepting || accept(event.url)) return;
            if (!allowed(event.url)) { fail('Destino inesperado na conexão do curso.'); return; }
            // Inspeciona apenas a presença de formulários; não lê senha, cookies ou campos do aluno.
            browser.executeScript({ code: `JSON.stringify({
                login: !!document.querySelector('input[type="password"], input[autocomplete="one-time-code"]'),
                consent: !!document.querySelector('form[action*="authorize"] [name="allow"], form[action*="authorize"] [name="authorize"]'),
                callback: document.querySelector('a#launchapp')?.href || '',
                loggedIn: document.body.classList.contains('loggedin')
            })` }).then(values => {
                if (settled || accepting) return;
                const state = JSON.parse(values?.[0] || '{}');
                if (state.callback && accept(state.callback)) return;
                if (state.login || state.consent) {
                    fail(state.login
                        ? 'A sessão SUAP precisa ser renovada no login principal do app. Seus dados foram mantidos.'
                        : 'Este ambiente exige autorização no SUAP. Solicite a liberação institucional para acesso automático.');
                    return;
                }
                // Alguns plugins concluem o OAuth na página inicial. Retoma o launch original uma única vez.
                if (state.loggedIn && new URL(event.url).origin === siteOrigin
                        && new URL(event.url).pathname !== launch.pathname && !restoredLaunch) {
                    restoredLaunch = true;
                    return browser.executeScript({ code: `location.replace(${JSON.stringify(launch.href)})` });
                }
            }).catch(() => fail('Não foi possível concluir a conexão automática do curso.'));
        }));
        subscriptions.push(browser.on('loaderror').subscribe(event => {
            if (accept(event.url)) return;
            fail('Não foi possível conectar este ambiente. Verifique sua conexão e tente novamente.');
        }));
        subscriptions.push(browser.on('exit').subscribe(() => fail('Conexão do curso cancelada.')));
    });
    return { browser, completion, cancel };
}
