/** Mesmo logo e gauge da tela de carregamento do Painel AVA. */
export function showHandoffLoading(): void {
    if (document.getElementById('ifrn-handoff-loading')) {
        return;
    }

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
        sessionStorage.removeItem('ifrn_moodle_pending_open_course');
        sessionStorage.removeItem('ifrn_moodle_poc_oauth_pending');
        sessionStorage.removeItem('ifrn_moodle_poc_resume_oauth');
        window.location.assign(painelUrl.toString());
    });
    document.body.appendChild(element);
}

export function hideHandoffLoading(): void {
    document.documentElement.classList.remove('ifrn-native-handoff');
    document.getElementById('ifrn-handoff-loading')?.remove();
}
