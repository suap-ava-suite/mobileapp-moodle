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

import { ChangeDetectionStrategy, Component, computed, ElementRef,
    input, linkedSignal, output, signal, ViewChild } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import { createCourseFavourites } from '../mobilemoodle/core_mobile/course-favourites';
import { PAINEL_HELP_LINKS, type PainelHelpLinkId } from '../services_mobile/painel-help-links';
import { withMoodleTeacherNames, type NativePainelCourse, type NativePainelGroup, type NativePainelModel } from './painel-native-model';
import { IfrnAcademicProgressComponent } from '../academic-progress/progress.component';
import { DEFAULT_PAINEL_FILTERS, PAINEL_FACETS, PAINEL_SITUATIONS, countPainelFilters, filterPainelCourses,
    listPainelFilterOptions, reconcilePainelFilters, type PainelFilterCategory, type PainelFilterOption,
    type PainelFilters } from './painel-filters';

interface PainelFilterState {
    applied: PainelFilters;
    draft: PainelFilters;
}

type PainelSection = 'courses' | 'profile' | 'help' | 'accessibility' | 'filter';

interface PainelFilterCategoryView {
    key: PainelFilterCategory;
    title: string;
    icon: string;
    options: readonly PainelFilterOption[];
    selected: string;
    selectionLabel?: string;
}

@Component({
    selector: 'ifrn-painel-native',
    templateUrl: './painel-native.html',
    styleUrls: ['./painel-native-theme.css', './painel-native.scss'],
    imports: [CoreSharedModule, IfrnAcademicProgressComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[class]': 'appearanceClasses()',
        '(document:keydown.escape)': 'closePanel()',
        '(document:ionBackButton)': 'onHardwareBack($event)',
    },
})
export class PainelNativeComponent {

    readonly data = input<NativePainelModel | null>(null);
    readonly moodleTeacherNames = input<ReadonlyMap<string, string> | null>(null);
    readonly busy = input(false);
    readonly openCourse = output<NativePainelCourse>();
    readonly manageEnrolment = output<NativePainelCourse>();
    readonly openHelp = output<PainelHelpLinkId>();
    readonly openMessages = output<void>();
    readonly openProfile = output<void>();
    readonly marketplace = output<void>();
    readonly logout = output<void>();
    readonly refresh = output<void>();
    readonly section = linkedSignal({
        source: () => !!this.data(),
        computation: (hasData, previous): PainelSection =>
            !hasData && previous?.value === 'filter' ? 'courses' : previous?.value ?? 'courses',
    });

    readonly group = signal<NativePainelGroup>('diarios');
    readonly favouriteRevision = signal(0);
    readonly preferenceError = signal('');
    readonly highContrast = signal(false);
    readonly fontScale = signal(100);
    readonly photoFailed = signal(false);
    readonly expandedFilter = signal<PainelFilterCategory | null>(null);
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
        { key: 'high_line_height', label: 'Linhas mais distantes', icon: 'menu-outline' },
    ];

    readonly panelTitle = computed(() => ({
        profile: 'Perfil', help: 'Ajuda', accessibility: 'Acessibilidade', filter: 'Filtros', courses: '',
    }[this.section()]));

    readonly pageTitle = computed(() => ({
        diarios: 'Meus Di\u00e1rios',
        coordenacoes: 'Salas de Coordena\u00e7\u00e3o',
        autoinscricoes: 'Cursos com Autoinscri\u00e7\u00e3o',
    }[this.group()]));

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

    @ViewChild('filterPanel') private filterPanel?: ElementRef<HTMLElement>;
    private filterTrigger?: HTMLButtonElement;
    private readonly groupCourses = computed(() => {
        const courses = this.data()?.groups[this.group()] ?? [];
        const teachers = this.moodleTeacherNames();

        return teachers?.size ? withMoodleTeacherNames(courses, teachers) : courses;
    });
    private readonly filterState = linkedSignal({
        source: () => ({ model: this.data(), courses: this.groupCourses() }),
        computation: ({ model, courses }, previous): PainelFilterState => {
            const previousModel = previous?.source.model;
            const sameOwner = model && (model === previousModel
                || (model.accountIdentity && model.accountIdentity === previousModel?.accountIdentity));
            const state = sameOwner ? previous?.value : undefined;

            return {
                applied: reconcilePainelFilters(state?.applied ?? DEFAULT_PAINEL_FILTERS, courses),
                draft: reconcilePainelFilters(state?.draft ?? DEFAULT_PAINEL_FILTERS, courses),
            };
        },
    });

    readonly appliedFilters = computed(() => this.filterState().applied);
    readonly draftFilters = computed(() => this.filterState().draft);
    private readonly draftEnvironment = computed(() => this.draftFilters().selected.environment);
    private readonly optionsByFacet = computed(() => listPainelFilterOptions(this.groupCourses(), this.draftEnvironment()));
    readonly activeFilterCount = computed(() => countPainelFilters(this.appliedFilters()));
    readonly filterLabel = computed(() => {
        const count = this.activeFilterCount();

        return count ? `${count} ${count === 1 ? 'filtro ativo' : 'filtros ativos'}` : PAINEL_SITUATIONS[0].label;
    });

    readonly filterCategories = computed<PainelFilterCategoryView[]>(() => {
        const { situation, selected } = this.draftFilters();
        const choices = this.optionsByFacet();

        return [{
            key: 'situation',
            title: PAINEL_SITUATIONS.find(option => option.id === situation)?.label ?? PAINEL_SITUATIONS[0].label,
            icon: 'book-outline',
            options: PAINEL_SITUATIONS,
            selected: situation,
        }, ...PAINEL_FACETS.map(facet => ({
            key: facet.key,
            title: facet.title,
            icon: facet.icon,
            options: choices[facet.key].length ? [{ id: '', label: facet.all }, ...choices[facet.key]] : [],
            selected: selected[facet.key] ?? '',
            selectionLabel: choices[facet.key].find(option => option.id === selected[facet.key])?.label,
        }))];
    });

    readonly courses = computed(() =>
        filterPainelCourses(this.groupCourses(), this.appliedFilters(), course => this.isFavourite(course)));

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

    toggleFilters(trigger: HTMLButtonElement): void {
        if (this.section() === 'filter') {
            this.closePanel();
        } else {
            this.openFilters(trigger);
        }
    }

    openFilters(trigger?: HTMLButtonElement): void {
        if (!this.data() || this.section() === 'filter') {
            return;
        }
        // Keep the rendered options in place while the filter is collapsing.
        this.expandedFilter.set(null);
        this.filterState.update(({ applied }) => ({ applied, draft: applied }));
        this.filterTrigger = trigger;
        this.section.set('filter');
    }

    closePanel(returnFocus?: HTMLButtonElement): void {
        const panel = this.filterPanel?.nativeElement;
        if (this.section() === 'filter' && panel?.contains(panel.ownerDocument.activeElement)) {
            returnFocus ??= this.filterTrigger;
        }
        returnFocus?.focus({ preventScroll: true });
        this.filterTrigger = undefined;
        this.section.set('courses');
    }

    onHardwareBack(event: Event): void {
        if (this.section() !== 'courses') {
            const detail = (event as CustomEvent<{ register: (priority: number, handler: () => void) => void }>).detail;
            detail?.register(101, () => this.closePanel());
        }
    }

    toggleFilterCategory(key: PainelFilterCategory): void {
        this.expandedFilter.update(expanded => expanded === key ? null : key);
    }

    editFilterQuery(query: string): void {
        this.editFilters(draft => ({ ...draft, query }));
    }

    chooseFilter(key: PainelFilterCategory, id: string): void {
        if (key === 'situation') {
            const option = PAINEL_SITUATIONS.find(value => value.id === id);
            if (option) {
                this.editFilters(draft => ({ ...draft, situation: option.id }));
            }

            return;
        }
        if (id && !this.optionsByFacet()[key].some(option => option.id === id)) {
            return;
        }
        this.editFilters(draft => {
            const selected = { ...draft.selected };
            if (id) {
                selected[key] = id;
            } else {
                delete selected[key];
            }

            return reconcilePainelFilters({ ...draft, selected }, this.groupCourses());
        });
    }

    private editFilters(update: (draft: PainelFilters) => PainelFilters): void {
        if (this.section() === 'filter') {
            this.filterState.update(state => ({ ...state, draft: update(state.draft) }));
        }
    }

    applyFilters(): void {
        if (this.section() !== 'filter') {
            return;
        }
        this.filterState.update(({ draft }) => ({ applied: draft, draft }));
        this.closePanel();
    }

    clearFilters(returnFocus?: HTMLButtonElement): void {
        this.filterState.set({ applied: DEFAULT_PAINEL_FILTERS, draft: DEFAULT_PAINEL_FILTERS });
        this.closePanel(returnFocus);
    }

    async toggleAccessibility(key: string): Promise<void> {
        if (!this.accessibilityOptions.some(option => option.key === key)) {return;}
        const enabled = !this.accessibility()[key];
        this.accessibility.update(values => ({ ...values, [key]: enabled }));
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
            if (this.section() === 'filter') {
                this.closePanel();
            }
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

}
