/*!
 * app-utils.ts
 * ----------------------------------------------------------------------------
 * Utilitários de UI compartilhados pelo App:
 * - descobrir pasta dos assets (logo, pages/*.html)
 * - escapeHtml / iniciais do nome
 * - clonar <template id="tpl-…">
 * - fetchText de partials HTML
 * - URL de volta ao login IFRN
 */
import { MM, App } from './namespace';

    /**
     * Base onde estão pages/, static/, etc.
     * Preferência: pasta do script mobilemoodle.js; fallback: URL atual.
     */
    function resolveAssetBase(): string {
        const scripts = document.getElementsByTagName('script');

        for (let i = scripts.length - 1; i >= 0; i -= 1) {
            const src = scripts[i].src || '';

            if (src.indexOf('/mobilemoodle.js') !== -1) {
                return src.replace(/\/mobilemoodle\.js(?:\?.*)?$/i, '/');
            }
        }

        try {
            return new URL('./', window.location.href).href;
        } catch {
            return '/mobilemoodle/';
        }
    }

    /** Sempre use antes de innerHTML com texto da API. */
    function escapeHtml(value: unknown): string {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** Primeira letra do nome para avatar sem foto. */
    function initials(name: unknown): string {
        const letters = String(name || 'U').trim().charAt(0).toUpperCase();

        return letters || 'U';
    }

    /** Clona o conteúdo de um <template> do index.html / pages/*.html. */
    function cloneTemplate(id: string): DocumentFragment | null {
        const tpl = document.getElementById(id) as HTMLTemplateElement | null;

        if (!tpl) {
            return null;
        }

        return tpl.content.cloneNode(true) as DocumentFragment;
    }

    /** Carrega HTML de partial (painel, curso, erros) com timeout de 10s. */
    async function fetchText(url: string): Promise<string> {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            controller.abort();
        }, 10000);

        try {
            const response = await fetch(url, {
                credentials: 'omit',
                cache: 'no-cache',
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error('Falha ao carregar interface (' + response.status + ').');
            }

            return response.text();
        } finally {
            window.clearTimeout(timer);
        }
    }

    /**
     * URL do app Ionic (PathLocationStrategy).
     * O painel mobilemoodle usa hash (#/painel); o Moodle Mobile/Ionic NÃO —
     * rotas Ionic são path reais: /login/..., não /#/login/...
     */
    function resolveIonicAppUrl(routePath: string): string {
        const path = routePath.startsWith('/') ? routePath : `/${routePath}`;

        try {
            const url = new URL(`..${path}`, App.ASSET_BASE || window.location.href);

            url.hash = '';
            url.search = '';

            return url.toString();
        } catch {
            return path;
        }
    }

    /** Volta um nível (www/) e abre o Marketplace, a única porta de autenticação. */
    function resolveLoginUrl(): string {
        return resolveIonicAppUrl('/login/marketplace-ifrn');
    }

    /** Agenda uma autoinscrição no Painel AVA usando a sessão web já autenticada. */
    function resolvePainelEnrolUrl(courseId: number | string, ambienteId: number | string = 2): string {
        const id = Number(courseId);
        const envId = Number(ambienteId);

        if (Number.isFinite(id) && id > 0 && Number.isFinite(envId) && envId > 0) {
            sessionStorage.setItem(
                'ifrn_painel_pending_enrol',
                JSON.stringify({ courseId: id, ambienteId: envId }),
            );
        }

        return resolveIonicAppUrl('/login/painel-enrol');
    }

    /**
     * Splash nativo Cordova — sobrevive ao reload do WebView (mobilemoodle → Ionic).
     * Sem isso, o documento some e o usuário vê a tela preta padrão do WebView.
     */
    function showNativeBridgeSplash(): void {
        try {
            sessionStorage.setItem('ifrn_course_handoff_pending', '1');
        } catch {
            // sessionStorage indisponível: segue só com o overlay DOM.
        }

        try {
            const splash = (window.navigator as Navigator & {
                splashscreen?: { show?: () => void };
            }).splashscreen;

            splash?.show?.();
        } catch {
            // Sem plugin: o overlay DOM + early handoff Ionic cobrem o gap.
        }
    }

    /**
     * Splash branco antes de sair da SPA — cobre o flash preto da troca de página.
     * O overlay DOM some com o document no assign; o SplashScreen nativo e o
     * early handoff Ionic (flag ifrn_course_handoff_pending) cobrem o bootstrap.
     */
    function showLeavingCourseSplash(): void {
        showNativeBridgeSplash();

        if (document.getElementById('ifrn-leaving-course-splash')) {
            return;
        }

        const logoSrc = (App.ASSET_BASE || '') + 'static/theme/ifrn/img/splash-logo.png';
        const element = document.createElement('div');
        element.id = 'ifrn-leaving-course-splash';
        element.setAttribute('role', 'status');
        element.setAttribute('aria-live', 'polite');
        element.setAttribute('aria-busy', 'true');
        element.innerHTML = `
            <style>
                #ifrn-leaving-course-splash {
                    position: fixed; inset: 0; z-index: 99999;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    gap: 1rem; background: #ffffff; color: #2b2b2b; text-align: center;
                    font-family: Rawline, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                    padding: max(24px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom));
                }
                #ifrn-leaving-course-splash .brand {
                    width: min(132px, 34vw); aspect-ratio: 1; display: grid; place-items: center; position: relative;
                }
                #ifrn-leaving-course-splash .ring {
                    position: absolute; inset: 0; width: 100%; height: 100%;
                    animation: ifrn-leave-spin 1.1s linear infinite;
                }
                #ifrn-leaving-course-splash .track { fill: none; stroke: rgba(22, 136, 33, 0.14); stroke-width: 4; }
                #ifrn-leaving-course-splash .arc {
                    fill: none; stroke: url(#ifrn-leave-gauge-grad); stroke-width: 5;
                    stroke-dasharray: 68 271; stroke-linecap: round;
                }
                #ifrn-leaving-course-splash img {
                    position: relative; width: 86%; height: 86%; border-radius: 50%; object-fit: cover;
                    background: #fff; box-shadow: 0 2px 10px rgba(11, 79, 27, 0.12); z-index: 1;
                }
                #ifrn-leaving-course-splash p { margin: 0; font-size: 1rem; font-weight: 600; }
                @keyframes ifrn-leave-spin { to { transform: rotate(360deg); } }
                @media (prefers-reduced-motion: reduce) {
                    #ifrn-leaving-course-splash .ring { animation: none; opacity: 0.9; }
                }
            </style>
            <div class="brand" aria-hidden="true">
                <svg class="ring" viewBox="0 0 120 120">
                    <defs>
                        <linearGradient id="ifrn-leave-gauge-grad" gradientUnits="userSpaceOnUse" x1="60" y1="6" x2="60" y2="114">
                            <stop offset="0%" stop-color="#168821" />
                            <stop offset="55%" stop-color="#2d8a45" />
                            <stop offset="100%" stop-color="#0b4f1b" />
                        </linearGradient>
                    </defs>
                    <circle class="track" cx="60" cy="60" r="54"></circle>
                    <circle class="arc" cx="60" cy="60" r="54"></circle>
                </svg>
                <img src="${logoSrc}" alt="" />
            </div>
            <p>Carregando curso...</p>
        `;
        document.body.appendChild(element);
    }

    /**
     * Abre a rota Ionic que estabelece sessão Moodle e abre o courseid nativo.
     * courseId/siteUrl/courseName ficam em sessionStorage (mesma origem) para
     * sobreviver ao OAuth / reload — o usuário não precisa clicar de novo.
     *
     * siteUrl deve ser a origem real do viewurl (nunca mock 127.0.0.1:8002).
     */
    function resolveMoodleOpenUrl(courseId: number | string, courseName?: string, siteUrl?: string): string {
        const id = Number(courseId);

        if (Number.isFinite(id) && id > 0) {
            try {
                // eslint-disable-next-line no-console
                console.log('[IFRN-COURSE] courseId recebido do Painel =', id);

                sessionStorage.setItem(
                    'ifrn_moodle_pending_open_course',
                    JSON.stringify({
                        courseId: id,
                        courseName: courseName || undefined,
                        siteUrl: siteUrl || undefined,
                    }),
                );

                // Mantém a última origem Moodle real para o logout web completo.
                // Essa chave não contém token/cookie/PII; somente a origem HTTPS.
                if (siteUrl && /^https:\/\//i.test(siteUrl)) {
                    sessionStorage.setItem('ifrn_moodle_last_site_url', new URL(siteUrl).origin);
                }
            } catch {
                // ignore quota
            }
        }

        showLeavingCourseSplash();

        return resolveIonicAppUrl('/login/moodle-open-course');
    }

    App.ASSET_BASE = resolveAssetBase();
    App.resolveLoginUrl = resolveLoginUrl;
    App.resolvePainelEnrolUrl = resolvePainelEnrolUrl;
    App.resolveMoodleOpenUrl = resolveMoodleOpenUrl;
    App.escapeHtml = escapeHtml;
    App.initials = initials;
    App.cloneTemplate = cloneTemplate;
    App.fetchText = fetchText;
