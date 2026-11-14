// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import { createCourseFavourites } from '../mobilemoodle/core_mobile/course-favourites';
import { loadVlibrasWidget } from '../mobilemoodle/core_mobile/vlibras-widget';
import { PAINEL_HELP_LINKS, type PainelHelpLinkId } from '../services_mobile/painel-help-links';
import { type NativePainelCourse, type NativePainelGroup, type NativePainelModel } from './painel-native-model';

@Component({
    selector: 'ifrn-painel-native',
    templateUrl: './painel-native.html',
    styleUrls: ['./painel-native-theme.css', './painel-native.scss'],
    imports: [CoreSharedModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[class]': 'appearanceClasses()',
        '(document:keydown.escape)': 'closePanel()',
        '(document:ionBackButton)': 'onHardwareBack($event)',
    },
})
export class PainelNativeComponent {

    readonly data = input<NativePainelModel | null>(null);
    readonly busy = input(false);
    readonly openCourse = output<NativePainelCourse>();
    readonly manageEnrolment = output<NativePainelCourse>();
    readonly openHelp = output<PainelHelpLinkId>();
    readonly openProfile = output<void>();
    readonly marketplace = output<void>();
    readonly logout = output<void>();
    readonly refresh = output<void>();
    readonly section = signal<'courses' | 'profile' | 'help' | 'accessibility' | 'filter'>('courses');
    readonly group = signal<NativePainelGroup>('diarios');
    readonly search = signal('');
    readonly onlyFavourites = signal(false);
    readonly favouriteRevision = signal(0);
    readonly preferenceError = signal('');
    readonly highContrast = signal(false);
    readonly fontScale = signal(100);
    readonly photoFailed = signal(false);
    readonly filter = signal<FilterSituacao>('allincludinghidden');
    readonly accessibility = signal<Record<string, boolean>>({});
    readonly colorMode = signal('default');
    readonly colorModeLabel = computed(() => new Map([
        ['default', 'Padr\u00e3o'],
        ['high_contrast', 'Alto contraste'],
        ['low_contrast', 'Contraste reduzido'],
        ['colorblind', 'Amig\u00e1vel a dalt\u00f4nicos'],
        ['grayscale', 'Escala de cinza'],
    ]).get(this.colorMode()) || 'Padr\u00e3o');

    readonly accessibilityOptions = [
        { key: 'dyslexia_friendly', label: 'Fonte amigável a disléxicos', icon: 'text-outline' },
        { key: 'highlight_links', label: 'Destacar links', icon: 'color-fill-outline' },
        { key: 'stop_animations', label: 'Parar animações', icon: 'pause-circle-outline' },
        { key: 'hidden_illustrative_image', label: 'Ocultar imagens ilustrativas', icon: 'image-outline' },
        { key: 'vlibras_active', label: 'Habilitar VLibras', icon: 'hand-left-outline' },
        { key: 'high_line_height', label: 'Linhas mais distantes', icon: 'menu-outline' },
    ];

    readonly filterOptions = [
        { id: 'inprogress' as const, label: 'Em andamento' },
        { id: 'allincludinghidden' as const, label: 'Todos os diários' },
        { id: 'favourites' as const, label: 'Favoritos' },
        { id: 'hidden' as const, label: 'Ocultos' },
    ];

    readonly panelTitle = computed(() => ({
        profile: 'Perfil', help: 'Ajuda', accessibility: 'Acessibilidade', filter: 'Filtros', courses: '',
    }[this.section()]));

    readonly pageTitle = computed(() => ({
        diarios: 'Meus Di\u00e1rios',
        coordenacoes: 'Salas de Coordena\u00e7\u00e3o',
        autoinscricoes: 'Cursos com Autoinscri\u00e7\u00e3o',
    }[this.group()]));

    readonly filterLabel = computed(() =>
        this.filterOptions.find(option => option.id === this.filter())?.label || 'Todos os di\u00e1rios');

    readonly initials = computed(() => (this.data()?.name || 'Estudante')
        .split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase());

    readonly appearanceClasses = computed(() => this.accessibilityOptions.filter(option => this.accessibility()[option.key])
        .map(option => option.key).concat(`color_mode_${this.colorMode()}`).join(' '));

    readonly helpLinks = Object.entries(PAINEL_HELP_LINKS).map(([id, page]) => ({ id: id as PainelHelpLinkId, title: page.title }));
    readonly tabs = [
        { id: 'diarios' as const, label: 'Diários' },
        { id: 'coordenacoes' as const, label: 'Coordenação' },
        { id: 'autoinscricoes' as const, label: 'Autoinscrição' },
    ];

    private readonly favourites = computed(() => {
        this.data();

        return createCourseFavourites();
    });

    readonly courses = computed(() => {
        this.favouriteRevision();
        const query = this.search().trim().toLocaleLowerCase('pt-BR');

        return (this.data()?.groups[this.group()] || []).filter(course =>
            (!(this.onlyFavourites() || this.filter() === 'favourites') || this.favourites().isFavourite(course)) &&
            (this.filter() !== 'inprogress' || course.progress !== 100) &&
            (this.filter() !== 'hidden' || !course.published) &&
            (!query || `${course.name} ${course.shortname} ${course.environment}`.toLocaleLowerCase('pt-BR').includes(query)));
    });

    constructor() {
        try {
            const prefs: unknown = JSON.parse(localStorage.getItem('ifrn_a11y_prefs') || '{}');
            if (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) {
                const saved = prefs as Record<string, unknown>;
                this.accessibility.set(Object.fromEntries(
                    this.accessibilityOptions.map(option => [option.key, saved[option.key] === true]),
                ));
                if ([100, 120, 130, 150, 160].includes(Number(saved['zoom_level']))) {
                    this.fontScale.set(Number(saved['zoom_level']));
                }
                const colorModes = ['default', 'high_contrast', 'low_contrast', 'colorblind', 'grayscale'];
                if (typeof saved['color_mode'] === 'string' && colorModes.includes(saved['color_mode'])) {
                    this.colorMode.set(saved['color_mode']);
                }
            }
        } catch { /* Corrupt preferences do not prevent rendering. */ }
    }

    closePanel(): void { this.section.set('courses'); }

    onHardwareBack(event: Event): void {
        if (this.section() !== 'courses') {
            const detail = (event as CustomEvent<{ register: (priority: number, handler: () => void) => void }>).detail;
            detail?.register(101, () => this.closePanel());
        }
    }

    setFilter(value: unknown): void {
        if (this.filterOptions.some(option => option.id === value)) {this.filter.set(value as FilterSituacao);}
        this.onlyFavourites.set(false);
    }

    clearFilters(): void {
        this.filter.set('allincludinghidden');
        this.onlyFavourites.set(false);
        this.search.set('');
        this.closePanel();
    }

    async toggleAccessibility(key: string): Promise<void> {
        if (!this.accessibilityOptions.some(option => option.key === key)) {return;}
        const enabled = !this.accessibility()[key];
        this.accessibility.update(values => ({ ...values, [key]: enabled }));
        if (key === 'vlibras_active') {
            if (enabled) {await this.enableLibras();}
            else {document.querySelector<HTMLElement>('[vw]')?.classList.remove('enabled');}
        }
        if (key === 'stop_animations') {document.body.classList.toggle('stop_animations', enabled);}
        this.saveAccessibility();
    }

    cycleZoom(): void {
        const values = [100, 120, 130, 150, 160];
        this.fontScale.set(values[(values.indexOf(this.fontScale()) + 1) % values.length]);
        this.saveAccessibility();
    }

    cycleColor(): void {
        const values = ['default', 'high_contrast', 'low_contrast', 'colorblind', 'grayscale'];
        this.colorMode.set(values[(values.indexOf(this.colorMode()) + 1) % values.length]);
        this.saveAccessibility();
    }

    private saveAccessibility(): void {
        try {
            const saved = JSON.parse(localStorage.getItem('ifrn_a11y_prefs') || '{}');
            const values = {
                ...(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}),
                ...this.accessibility(),
            };
            values['zoom_level'] = this.fontScale();
            values['color_mode'] = this.colorMode();
            localStorage.setItem('ifrn_a11y_prefs', JSON.stringify(values));
        } catch { this.preferenceError.set('Não foi possível salvar as preferências de acessibilidade.'); }
    }

    setGroup(value: unknown): void {
        if (this.tabs.some(tab => tab.id === value)) {
            this.group.set(value as NativePainelGroup);
        }
    }

    canOpen(course: NativePainelCourse): boolean {
        return !this.busy() && !!course.moodle_course_id && !!course.moodle_site_url;
    }

    selectCourse(course: NativePainelCourse): void {
        if (this.canOpen(course)) {
            this.openCourse.emit(course);
        }
    }

    isFavourite(course: NativePainelCourse): boolean {
        this.favouriteRevision();

        return this.favourites().isFavourite(course);
    }

    toggleFavourite(course: NativePainelCourse): void {
        try {
            this.favourites().toggle(course);
            this.preferenceError.set('');
            this.favouriteRevision.update(value => value + 1);
        } catch {
            this.preferenceError.set('Não foi possível salvar o favorito. Tente novamente.');
        }
    }

    async enableLibras(): Promise<void> {
        try {
            await loadVlibrasWidget();
            this.preferenceError.set('');
        } catch {
            this.preferenceError.set('Não foi possível carregar o VLibras. Verifique sua conexão e tente novamente.');
        }
    }

}
