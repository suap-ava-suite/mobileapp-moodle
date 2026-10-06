/** Mesmo logo e gauge da tela de carregamento do Painel AVA. */
export function showHandoffLoading(): void {
    if (document.getElementById('ifrn-handoff-loading')) {
        return;
    }

    const element = document.createElement('div');
    element.id = 'ifrn-handoff-loading';
    element.innerHTML = `<div class="ifrn-handoff__splash" role="status" aria-live="polite" aria-busy="true"><div class="ava-splash__brand">
                        <div class="ava-splash__gauge" aria-hidden="true">
                            <svg class="ava-splash__gauge-svg" viewBox="0 0 120 120" aria-hidden="true">
                                <defs>
                                    <linearGradient id="ifrn-handoff-gauge-grad" gradientUnits="userSpaceOnUse" x1="60" y1="6" x2="60" y2="114">
                                        <stop offset="0%" stop-color="#2d8a45"></stop>
                                        <stop offset="55%" stop-color="#1351b4"></stop>
                                        <stop offset="100%" stop-color="#071d41"></stop>
                                    </linearGradient>
                                </defs>
                                <circle class="ava-splash__gauge-track" cx="60" cy="60" r="54"></circle>
                                <circle class="ava-splash__gauge-arc" cx="60" cy="60" r="54"></circle>
                            </svg>
                        </div>
                        <img class="ava-splash__logo" src="mobilemoodle/static/theme/ifrn/img/splash-logo.png" alt="Painel AVA">
                    </div>
                    <p class="ava-splash__text">Carregando curso...</p></div>`;
    document.body.appendChild(element);
}

export function hideHandoffLoading(): void {
    document.documentElement.classList.remove('ifrn-native-handoff');
    document.getElementById('ifrn-handoff-loading')?.remove();
}
