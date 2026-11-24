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

export const PAINEL_FACETS = [
    { key: 'semester', title: 'Semestres...', icon: 'calendar-outline', all: 'Todos os semestres' },
    { key: 'period', title: 'Períodos...', icon: 'time-outline', all: 'Todos os períodos' },
    { key: 'module', title: 'Módulos...', icon: 'layers-outline', all: 'Todos os módulos' },
    { key: 'discipline', title: 'Disciplinas...', icon: 'library-outline', all: 'Todas as disciplinas' },
    { key: 'academicCourse', title: 'Cursos...', icon: 'school-outline', all: 'Todos os cursos' },
    { key: 'environment', title: 'Ambientes...', icon: 'globe-outline', all: 'Todos os ambientes' },
] as const;

export const PAINEL_SITUATIONS = [
    { id: 'inprogress', label: 'Diários em andamento' },
    { id: 'favourites', label: 'Favoritos' },
    { id: 'unpublished', label: 'Não publicados' },
] as const;

export type PainelFacet = typeof PAINEL_FACETS[number]['key'];
export type PainelFilterCategory = 'situation' | PainelFacet;
export type PainelSituation = typeof PAINEL_SITUATIONS[number]['id'];

export interface PainelFilterOption {
    readonly id: string;
    readonly label: string;
}

export interface PainelFilterableCourse {
    readonly filterOptions: Partial<Record<PainelFacet, PainelFilterOption>>;
    readonly searchableText: string;
    readonly published: boolean;
}

export interface PainelFilters {
    readonly situation: PainelSituation;
    readonly query: string;
    readonly selected: Readonly<Partial<Record<PainelFacet, string>>>;
}

export const DEFAULT_PAINEL_FILTERS: PainelFilters = { situation: 'inprogress', query: '', selected: {} };

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/**
 * Usa a mesma normalização no índice dos cartões e no texto digitado.
 *
 * @param value Texto da API ou do campo de pesquisa.
 * @returns Texto comparável sem caixa, acentos ou espaços nas pontas.
 */
export function normalizePainelSearch(value: string): string {
    return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

/**
 * O ambiente limita os outros filtros sem impedir que se escolha outro ambiente.
 *
 * @param courses Lista autorizada da aba.
 * @param environment ID do ambiente selecionado, quando houver.
 * @returns Cursos no escopo do ambiente.
 */
function forEnvironment<T extends PainelFilterableCourse>(courses: readonly T[], environment?: string): readonly T[] {
    return environment ? courses.filter(course => course.filterOptions.environment?.id === environment) : courses;
}

/**
 * Um valor do catálogo só vira opção se estiver associado a um cartão da aba atual.
 *
 * @param courses Lista autorizada da aba.
 * @param environment ID que restringe as outras categorias.
 * @returns Opções únicas de cada categoria.
 */
export function listPainelFilterOptions(
    courses: readonly PainelFilterableCourse[],
    environment?: string,
): Record<PainelFacet, PainelFilterOption[]> {
    const scoped = forEnvironment(courses, environment);

    return Object.fromEntries(PAINEL_FACETS.map(({ key }) => {
        const options = new Map<string, PainelFilterOption>();
        for (const course of key === 'environment' ? courses : scoped) {
            const option = course.filterOptions[key];
            if (option && !options.has(option.id)) {
                options.set(option.id, option);
            }
        }
        const direction = key === 'semester' ? -1 : 1;

        return [key, [...options.values()].sort((a, b) => direction * collator.compare(a.label, b.label))];
    })) as Record<PainelFacet, PainelFilterOption[]>;
}

/**
 * Descarta seleções sem correspondência após atualizar o painel ou mudar de aba ou ambiente.
 *
 * @param filters Critérios a preservar sempre que possível.
 * @param courses Lista atualizada da aba.
 * @returns Estado validado, com a mesma referência quando nada foi descartado.
 */
export function reconcilePainelFilters(filters: PainelFilters, courses: readonly PainelFilterableCourse[]): PainelFilters {
    const selected = { ...filters.selected };
    if (selected.environment && !courses.some(course => course.filterOptions.environment?.id === selected.environment)) {
        delete selected.environment;
    }
    const scoped = forEnvironment(courses, selected.environment);
    for (const { key } of PAINEL_FACETS) {
        if (selected[key] && !scoped.some(course => course.filterOptions[key]?.id === selected[key])) {
            delete selected[key];
        }
    }

    return Object.keys(selected).length === Object.keys(filters.selected).length ? filters : { ...filters, selected };
}

/**
 * Aplica a combinação usando a lista da sessão atual e as preferências de favorito existentes.
 *
 * @param courses Lista autorizada da aba.
 * @param filters Critérios já aplicados pelo estudante.
 * @param isFavourite Preferência de favorito da sessão ativa.
 * @returns Cartões que satisfazem todos os critérios, na ordem original.
 */
export function filterPainelCourses<T extends PainelFilterableCourse>(
    courses: readonly T[],
    filters: PainelFilters,
    isFavourite: (course: T) => boolean,
): T[] {
    const query = normalizePainelSearch(filters.query);
    const criteria = PAINEL_FACETS.filter(({ key }) => filters.selected[key]);

    // A consulta existente ao AVA já seleciona inprogress. A barra acadêmica serve para exibição.
    return courses.filter(course =>
        (filters.situation !== 'favourites' || isFavourite(course))
        && (filters.situation !== 'unpublished' || !course.published)
        && (!query || course.searchableText.includes(query))
        && criteria.every(({ key }) => course.filterOptions[key]?.id === filters.selected[key]));
}

/**
 * A situação padrão fica fora da contagem de filtros personalizados.
 *
 * @param filters Estado aplicado no Painel.
 * @returns Total de critérios personalizados exibidos no indicador.
 */
export function countPainelFilters(filters: PainelFilters): number {
    return Object.keys(filters.selected).length + Number(!!filters.query.trim())
        + Number(filters.situation !== DEFAULT_PAINEL_FILTERS.situation);
}
