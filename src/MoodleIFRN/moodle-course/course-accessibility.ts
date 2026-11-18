import { Injectable } from '@angular/core';

/** Mesma chave do Painel AVA / theme_ifrn25 — prefs compartilhadas. */
const STORAGE_KEY = 'ifrn_a11y_prefs';

export type IfrnA11yBoolKey =
    | 'dyslexia_friendly'
    | 'highlight_links'
    | 'stop_animations'
    | 'hidden_illustrative_image'
    | 'high_line_height';

export type IfrnColorMode = 'default' | 'high_contrast' | 'low_contrast' | 'colorblind' | 'grayscale';

export interface IfrnA11yState {
    dyslexia_friendly: boolean;
    highlight_links: boolean;
    stop_animations: boolean;
    hidden_illustrative_image: boolean;
    high_line_height: boolean;
    zoom_level: number;
    color_mode: IfrnColorMode;
}

const BOOL_KEYS: IfrnA11yBoolKey[] = [
    'dyslexia_friendly',
    'highlight_links',
    'stop_animations',
    'hidden_illustrative_image',
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

/** Acessibilidade do curso nativo (espelho do Painel AVA). */
@Injectable({ providedIn: 'root' })
export class IfrnCourseAccessibilityService {

    private readonly state: IfrnA11yState = {
        dyslexia_friendly: false,
        highlight_links: false,
        stop_animations: false,
        hidden_illustrative_image: false,
        high_line_height: false,
        zoom_level: 100,
        color_mode: 'default',
    };

    private ready = false;

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

    }

}
