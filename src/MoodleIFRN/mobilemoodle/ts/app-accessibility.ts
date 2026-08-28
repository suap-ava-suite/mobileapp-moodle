/**
 * app-accessibility.ts
 * Preferências de acessibilidade do Painel AVA (localStorage).
 */
import { MM, App } from './namespace';


    const STORAGE_KEY = 'ifrn_a11y_prefs';

    const BOOL_KEYS: A11yBoolKey[] = [
        'dyslexia_friendly',
        'remove_justify',
        'highlight_links',
        'stop_animations',
        'hidden_illustrative_image',
        'big_cursor',
        'vlibras_active',
        'high_line_height',
    ];

    const ZOOM_OPTIONS = [100, 120, 130, 150, 160];
    const COLOR_MODE_OPTIONS: ColorMode[] = ['default', 'high_contrast', 'low_contrast', 'colorblind', 'grayscale'];

    const COLOR_MODE_LABELS: Record<ColorMode, string> = {
        default: 'Padrão',
        high_contrast: 'Alto contraste',
        low_contrast: 'Contraste reduzido',
        colorblind: 'Amigável a daltônicos',
        grayscale: 'Escala de cinza',
    };

    const state: A11yState = {
        dyslexia_friendly: false,
        remove_justify: false,
        highlight_links: false,
        stop_animations: false,
        hidden_illustrative_image: false,
        big_cursor: false,
        vlibras_active: false,
        high_line_height: false,
        zoom_level: 100,
        color_mode: 'default',
    };

    let vlibrasReady = false;

    function getEl(id: string): HTMLElement | null {
        return document.getElementById(id);
    }

    function loadState(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);

            if (!raw) {
                return;
            }

            const saved = JSON.parse(raw) as Partial<A11yState>;

            BOOL_KEYS.forEach((key) => {
                if (typeof saved[key] === 'boolean') {
                    state[key] = saved[key];
                }
            });

            if (ZOOM_OPTIONS.indexOf(Number(saved.zoom_level)) !== -1) {
                state.zoom_level = Number(saved.zoom_level);
            }

            if (saved.color_mode && COLOR_MODE_OPTIONS.indexOf(saved.color_mode) !== -1) {
                state.color_mode = saved.color_mode;
            }
        } catch {
            // ignore corrupt storage
        }
    }

    function saveState(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
            // ignore quota / private mode
        }
    }

    function ensureVlibras(): void {
        if (vlibrasReady || !state.vlibras_active) {
            return;
        }

        if (!document.querySelector('div[vw]')) {
            const root = document.createElement('div');

            root.setAttribute('vw', '');
            root.className = 'enabled';
            root.innerHTML =
                '<div vw-access-button class="active"></div>' +
                '<div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
            document.body.appendChild(root);
        }

        if (window.VLibras?.Widget) {
            try {
                new window.VLibras.Widget('https://vlibras.gov.br/app');
                vlibrasReady = true;
            } catch {
                vlibrasReady = true;
            }

            return;
        }

        if (document.getElementById('vlibras-script')) {
            return;
        }

        const script = document.createElement('script');

        script.id = 'vlibras-script';
        script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
        script.onload = () => {
            try {
                new window.VLibras!.Widget('https://vlibras.gov.br/app');
                vlibrasReady = true;
            } catch {
                vlibrasReady = true;
            }
        };
        document.body.appendChild(script);
    }

    function applyToBody(): void {
        const body = document.body;

        BOOL_KEYS.forEach((key) => {
            body.classList.toggle(key, !!state[key]);
        });

        COLOR_MODE_OPTIONS.forEach((mode) => {
            body.classList.remove('color_mode_' + mode);
        });

        if (state.color_mode && state.color_mode !== 'default') {
            body.classList.add('color_mode_' + state.color_mode);
        } else {
            body.classList.add('color_mode_default');
        }

        if (state.zoom_level && state.zoom_level !== 100) {
            body.setAttribute('data-zoom', String(state.zoom_level));
        } else {
            body.removeAttribute('data-zoom');
        }

        if (state.vlibras_active) {
            ensureVlibras();
        }
    }

    function setBool(key: A11yBoolKey, value: boolean): void {
        if (BOOL_KEYS.indexOf(key) === -1) {
            return;
        }

        state[key] = !!value;
        saveState();
        applyToBody();
    }

    function cycleZoom(): void {
        const idx = ZOOM_OPTIONS.indexOf(state.zoom_level);
        const next = ZOOM_OPTIONS[(idx + 1) % ZOOM_OPTIONS.length];

        state.zoom_level = next;
        saveState();
        applyToBody();
        syncPanelControls();
    }

    function cycleColorMode(): void {
        const idx = COLOR_MODE_OPTIONS.indexOf(state.color_mode);
        const next = COLOR_MODE_OPTIONS[(idx + 1) % COLOR_MODE_OPTIONS.length];

        state.color_mode = next;
        saveState();
        applyToBody();
        syncPanelControls();
    }

    function renderIndicators(container: HTMLElement | null, mode: 'zoom' | 'color'): void {
        if (!container) {
            return;
        }

        container.innerHTML = '';

        if (mode === 'zoom') {
            ZOOM_OPTIONS.filter((level) => level > 100).forEach((level) => {
                const span = document.createElement('span');

                span.className = 'cycle-indicator' + (level <= state.zoom_level ? ' active' : '');
                container.appendChild(span);
            });

            return;
        }

        COLOR_MODE_OPTIONS.filter((m) => m !== 'default').forEach((m) => {
            const span = document.createElement('span');

            span.className = 'cycle-indicator' + (m === state.color_mode ? ' active' : '');
            container.appendChild(span);
        });
    }

    function syncPanelControls(): void {
        BOOL_KEYS.forEach((key) => {
            const el = document.getElementById(key) as HTMLInputElement | null;

            if (el && el.type === 'checkbox') {
                el.checked = !!state[key];
            }
        });

        const zoomWrap = getEl('selector-cycle-access');
        const zoomValue = getEl('zoom-value');
        const zoomIndicators = getEl('cycle-indicators');
        const colorWrap = getEl('selector-cycle-color');
        const colorLabel = getEl('color-mode-label');
        const colorIndicators = getEl('color-indicators');

        if (zoomWrap) {
            zoomWrap.classList.toggle('active', state.zoom_level > 100);
        }

        if (zoomValue) {
            zoomValue.textContent = state.zoom_level + '%';
        }

        renderIndicators(zoomIndicators, 'zoom');

        if (colorWrap) {
            colorWrap.classList.toggle('active', state.color_mode !== 'default');
        }

        if (colorLabel) {
            colorLabel.textContent = COLOR_MODE_LABELS[state.color_mode] || 'Padrão';
        }

        renderIndicators(colorIndicators, 'color');
    }

    function bindPanelControls(): void {
        BOOL_KEYS.forEach((key) => {
            const el = document.getElementById(key) as HTMLInputElement | null;

            if (!el) {
                return;
            }

            el.checked = !!state[key];
            el.addEventListener('change', () => {
                setBool(key, el.checked);
            });
        });

        const zoomBtn = getEl('cycle-toggle');
        const colorBtn = getEl('color-mode-toggle');

        if (zoomBtn) {
            zoomBtn.addEventListener('click', (event) => {
                event.preventDefault();
                cycleZoom();
            });
        }

        if (colorBtn) {
            colorBtn.addEventListener('click', (event) => {
                event.preventDefault();
                cycleColorMode();
            });
        }

        syncPanelControls();
    }

    function init(): void {
        loadState();
        applyToBody();
    }

    App.A11y = {
        init,
        bindPanel: bindPanelControls,
        syncPanel: syncPanelControls,
        getState: () => Object.assign({}, state),
        COLOR_MODE_LABELS,
    };
