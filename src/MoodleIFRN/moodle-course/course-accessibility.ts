import { Injectable, signal } from '@angular/core';
import { loadVlibrasWidget } from '../mobilemoodle/core_mobile/vlibras-widget';

/** Mesma chave do Painel AVA / theme_ifrn25 — prefs compartilhadas. */
const STORAGE_KEY = 'ifrn_a11y_prefs';
const ESCAPE_ID = 'ifrn-vlibras-escape';

export type IfrnA11yBoolKey =
    | 'dyslexia_friendly'
    | 'highlight_links'
    | 'stop_animations'
    | 'hidden_illustrative_image'
    | 'vlibras_active'
    | 'high_line_height';

export type IfrnColorMode = 'default' | 'high_contrast' | 'low_contrast' | 'colorblind' | 'grayscale';

export interface IfrnA11yState {
    dyslexia_friendly: boolean;
    highlight_links: boolean;
    stop_animations: boolean;
    hidden_illustrative_image: boolean;
    vlibras_active: boolean;
    high_line_height: boolean;
    zoom_level: number;
    color_mode: IfrnColorMode;
}

const BOOL_KEYS: IfrnA11yBoolKey[] = [
    'dyslexia_friendly',
    'highlight_links',
    'stop_animations',
    'hidden_illustrative_image',
    'vlibras_active',
    'high_line_height',
];

const ZOOM_OPTIONS = [100, 120, 130, 150, 160];
const COLOR_MODE_OPTIONS: IfrnColorMode[] = [
    'default', 'high_contrast', 'low_contrast', 'colorblind', 'grayscale',
];

export const IFRN_COLOR_MODE_LABELS: Record<IfrnColorMode, string> = {
    default: 'Padrão',
    high_contrast: 'Alto contraste',
    low_contrast: 'Contraste reduzido',
    colorblind: 'Amigável a daltônicos',
    grayscale: 'Escala de cinza',
};

/**
 * Acessibilidade do curso nativo (espelho do Painel AVA).
 * VLibras fica compacto e com botão de saída para não travar o app.
 */
@Injectable({ providedIn: 'root' })
export class IfrnCourseAccessibilityService {

    private readonly state: IfrnA11yState = {
        dyslexia_friendly: false,
        highlight_links: false,
        stop_animations: false,
        hidden_illustrative_image: false,
        vlibras_active: false,
        high_line_height: false,
        zoom_level: 100,
        color_mode: 'default',
    };

    private ready = false;
    private vlibrasReady = false;
    private vlibrasLoading = false;
    private vlibrasFailed = false;
    private escapeBound = false;

    readonly vlibrasLoadError = signal(false);

    /** Lê localStorage e aplica no body (idempotente). */
    init(): void {
        if (!this.ready) {
            this.loadState();
            this.ready = true;
        }
        this.applyToBody();
    }

    getState(): IfrnA11yState {
        return { ...this.state };
    }

    get zoomLevel(): number {
        return this.state.zoom_level;
    }

    get colorMode(): IfrnColorMode {
        return this.state.color_mode;
    }

    get colorModeLabel(): string {
        return IFRN_COLOR_MODE_LABELS[this.state.color_mode] || 'Padrão';
    }

    isEnabled(key: IfrnA11yBoolKey): boolean {
        return !!this.state[key];
    }

    setBool(key: IfrnA11yBoolKey, value: boolean): void {
        if (!BOOL_KEYS.includes(key)) {
            return;
        }
        this.state[key] = !!value;
        if (key === 'vlibras_active') {
            this.vlibrasLoadError.set(false);
            if (value) {
                this.vlibrasFailed = false;
            }
        }
        this.saveState();
        this.applyToBody();
    }

    cycleZoom(): void {
        const idx = ZOOM_OPTIONS.indexOf(this.state.zoom_level);
        this.state.zoom_level = ZOOM_OPTIONS[(idx + 1) % ZOOM_OPTIONS.length];
        this.saveState();
        this.applyToBody();
    }

    cycleColorMode(): void {
        const idx = COLOR_MODE_OPTIONS.indexOf(this.state.color_mode);
        this.state.color_mode = COLOR_MODE_OPTIONS[(idx + 1) % COLOR_MODE_OPTIONS.length];
        this.saveState();
        this.applyToBody();
    }

    /**
     * Fecha o painel/avatar do VLibras e devolve o controle ao app.
     * Usado pelo botão flutuante "Fechar Libras".
     */
    dismissVlibrasUi(): void {
        const root = document.querySelector('div[vw]') as HTMLElement | null;
        if (!root) {
            this.setBool('vlibras_active', false);

            return;
        }

        // Tenta recolher pelo botão oficial; se o painel continuar aberto, desliga o widget.
        const access = root.querySelector('[vw-access-button]') as HTMLElement | null;
        const wrapper = root.querySelector('[vw-plugin-wrapper]') as HTMLElement | null;
        const looksOpen = !!wrapper && (
            wrapper.classList.contains('active')
            || wrapper.getAttribute('aria-hidden') === 'false'
            || getComputedStyle(wrapper).display !== 'none'
        );

        if (looksOpen && access) {
            access.click();
        }

        // Garante saída mesmo se o widget estiver em “tela cheia”/iframe travando toques.
        window.setTimeout(() => {
            const still = document.querySelector('div[vw] [vw-plugin-wrapper]') as HTMLElement | null;
            const stillOpen = !!still && getComputedStyle(still).display !== 'none'
                && still.getBoundingClientRect().height > 80;
            if (stillOpen || document.body.classList.contains('vlibras_active')) {
                this.setBool('vlibras_active', false);
            }
        }, 120);
    }

    private loadState(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return;
            }
            const saved = JSON.parse(raw) as Partial<IfrnA11yState>;
            BOOL_KEYS.forEach((key) => {
                if (typeof saved[key] === 'boolean') {
                    this.state[key] = saved[key];
                }
            });
            if (ZOOM_OPTIONS.includes(Number(saved.zoom_level))) {
                this.state.zoom_level = Number(saved.zoom_level);
            }
            if (saved.color_mode && COLOR_MODE_OPTIONS.includes(saved.color_mode)) {
                this.state.color_mode = saved.color_mode;
            }
        } catch {
            // storage corrompido ou indisponível
        }
    }

    private saveState(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        } catch {
            // quota / modo privado
        }
    }

    private applyToBody(): void {
        const body = document.body;
        body.classList.add('ifrn-course-a11y');

        BOOL_KEYS.forEach((key) => {
            body.classList.toggle(key, !!this.state[key]);
        });
        // Remove a legacy class left by an older mobile accessibility preference.
        body.classList.remove('big_cursor');

        COLOR_MODE_OPTIONS.forEach((mode) => {
            body.classList.remove('color_mode_' + mode);
        });
        if (this.state.color_mode && this.state.color_mode !== 'default') {
            body.classList.add('color_mode_' + this.state.color_mode);
        } else {
            body.classList.add('color_mode_default');
        }

        if (this.state.zoom_level && this.state.zoom_level !== 100) {
            body.setAttribute('data-zoom', String(this.state.zoom_level));
        } else {
            body.removeAttribute('data-zoom');
        }

        if (this.state.vlibras_active) {
            this.ensureVlibras();
            this.ensureEscapeButton();
        } else {
            this.hideVlibras();
            this.removeEscapeButton();
        }
    }

    private ensureVlibras(): void {
        if (this.vlibrasFailed) {
            return;
        }

        // The shared loader also restores the wrapper's inline display after re-enabling.
        const load = loadVlibrasWidget();
        if (this.vlibrasReady || this.vlibrasLoading) {
            return;
        }

        this.vlibrasLoading = true;
        void load.then(() => {
            this.vlibrasReady = true;
            this.vlibrasLoading = false;
            this.vlibrasLoadError.set(false);
        }).catch(() => {
            this.vlibrasReady = false;
            this.vlibrasLoading = false;
            if (this.state.vlibras_active) {
                this.vlibrasFailed = true;
                this.vlibrasLoadError.set(true);
            }
        });
    }

    private hideVlibras(): void {
        const root = document.querySelector('div[vw]') as HTMLElement | null;
        root?.classList.remove('enabled');
        // Recolhe o wrapper para não deixar overlay invisível capturando toques.
        const wrapper = root?.querySelector('[vw-plugin-wrapper]') as HTMLElement | null;
        if (wrapper) {
            wrapper.style.display = 'none';
        }
    }

    private ensureEscapeButton(): void {
        let btn = document.getElementById(ESCAPE_ID) as HTMLButtonElement | null;
        if (!btn) {
            btn = document.createElement('button');
            btn.id = ESCAPE_ID;
            btn.type = 'button';
            btn.className = 'ifrn-vlibras-escape';
            btn.setAttribute('aria-label', 'Fechar VLibras e voltar ao aplicativo');
            btn.innerHTML = '<span aria-hidden="true">✕</span><span>Fechar Libras</span>';
            document.body.appendChild(btn);
        }
        if (!this.escapeBound) {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.dismissVlibrasUi();
            });
            this.escapeBound = true;
        }
        btn.hidden = false;
    }

    private removeEscapeButton(): void {
        const btn = document.getElementById(ESCAPE_ID);
        if (btn) {
            btn.hidden = true;
        }
    }

}
