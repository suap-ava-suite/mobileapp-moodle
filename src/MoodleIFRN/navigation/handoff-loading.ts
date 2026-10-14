const HANDOFF_PENDING_KEY = 'ifrn_course_handoff_pending';
const PENDING_OPEN_COURSE_KEY = 'ifrn_moodle_pending_open_course';

/** Esconde o SplashScreen Cordova quando o overlay DOM IFRN já cobre a tela. */
function hideNativeSplashScreen(): void {
    try {
        const splash = (window.navigator as Navigator & {
            splashscreen?: { hide?: () => void };
        }).splashscreen;

        splash?.hide?.();
    } catch {
        // Sem plugin: nada a fazer.
    }
}

/**
 * True só no reload Painel → Ionic (flag curta).
 * Não usa ifrn_moodle_pending_open_course: essa chave vive até o curso abrir e
 * rearmar o handoff no meio da navegação (usuário fica em “Carregando…” para sempre).
 */
export function shouldShowCourseHandoffOnBoot(): boolean {
    try {
        return sessionStorage.getItem(HANDOFF_PENDING_KEY) === '1';
    } catch {
        return false;
    }
}

/** Mesmo logo e gauge da tela de carregamento do Painel AVA. */
export function showHandoffLoading(): void {
    document.documentElement.classList.add('ifrn-native-handoff');
    try {
        sessionStorage.setItem(HANDOFF_PENDING_KEY, '1');
    } catch {
        // ignore
    }

    const existing = document.getElementById('ifrn-handoff-loading');
    if (existing?.querySelector('.ifrn-handoff__back')) {
        hideNativeSplashScreen();

        return;
    }
    // Early script monta um overlay sem o botão Voltar — substitui pelo completo.
    existing?.remove();

    const element = document.createElement('div');
    element.id = 'ifrn-handoff-loading';
    const base = document.querySelector('base')?.getAttribute('href') || '/';
    const root = base.endsWith('/') ? base : `${base}/`;
    const painelUrl = new URL(`${root}mobilemoodle/index.html#/painel`, window.location.origin);
    element.innerHTML = `<div class="ifrn-handoff__splash" role="status" aria-live="polite" aria-busy="true"><div class="ava-splash__brand">
                        <div class="ava-splash__gauge" aria-hidden="true">
                            <svg class="ava-splash__gauge-svg" viewBox="0 0 120 120" aria-hidden="true">
                                <defs>
                                    <linearGradient id="ifrn-handoff-gauge-grad" gradientUnits="userSpaceOnUse" x1="60" y1="6" x2="60" y2="114">
                                        <stop offset="0%" stop-color="#168821"></stop>
                                        <stop offset="55%" stop-color="#2d8a45"></stop>
                                        <stop offset="100%" stop-color="#0b4f1b"></stop>
                                    </linearGradient>
                                </defs>
                                <circle class="ava-splash__gauge-track" cx="60" cy="60" r="54"></circle>
                                <circle class="ava-splash__gauge-arc" cx="60" cy="60" r="54"></circle>
                            </svg>
                        </div>
                        <img class="ava-splash__logo" src="mobilemoodle/static/theme/ifrn/img/splash-logo.png" alt="Painel AVA">
                    </div>
                    <p class="ava-splash__text">Carregando curso...</p><button type="button" class="ifrn-handoff__back">Voltar ao Painel</button></div>`;
    element.querySelector('button')?.addEventListener('click', () => {
        hideHandoffLoading();
        sessionStorage.removeItem(PENDING_OPEN_COURSE_KEY);
        sessionStorage.removeItem('ifrn_moodle_poc_oauth_pending');
        sessionStorage.removeItem('ifrn_moodle_poc_resume_oauth');
        window.location.assign(painelUrl.toString());
    });
    document.body.appendChild(element);
    // Overlay DOM já cobre; libera o splash nativo para não empilhar camadas.
    hideNativeSplashScreen();
}

export function hideHandoffLoading(): void {
    const element = document.getElementById('ifrn-handoff-loading');
    if (element) {
        element.style.transition = 'opacity 0.28s ease-out';
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
        window.setTimeout(() => {
            element.remove();
            document.documentElement.classList.remove('ifrn-native-handoff');
        }, 280);
    } else {
        document.documentElement.classList.remove('ifrn-native-handoff');
    }
    try {
        sessionStorage.removeItem(HANDOFF_PENDING_KEY);
    } catch {
        // ignore
    }
    hideNativeSplashScreen();
}
