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

import { resolveCourseSite } from '../mobilemoodle/core_mobile/course-target';
import { normalizePainelSearch, type PainelFacet, type PainelFilterableCourse, type PainelFilterOption } from './painel-filters';

export type NativePainelGroup = 'diarios' | 'coordenacoes' | 'autoinscricoes';
export interface NativePainelCourse extends DashboardCourse, PainelFilterableCourse {
    key: string;
    academicProgram?: string;
    academicCode?: string;
    /** Undefined means missing metadata. An empty string means the supplied assignments are inactive. */
    teacherNames?: string;
    isAcademicEnvironment: boolean;
    publicationStatus?: 'published' | 'unpublished';
}
export interface NativePainelModel {
    name: string;
    photo?: string;
    accountIdentity?: string;
    groups: Record<NativePainelGroup, NativePainelCourse[]>;
}

type FilterLabels = Partial<Record<PainelFacet, ReadonlyMap<string, string>>>;

/**
 * Keeps only plain records from the API.
 *
 * @param value Untrusted API field.
 * @returns A record or an empty record.
 */
function object(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/**
 * Picks a non-empty display string without coercing objects.
 *
 * @param values Candidate API values.
 * @returns The first usable string.
 */
function text(...values: unknown[]): string {
    return values.find((value): value is string => typeof value === 'string' && !!value.trim())?.trim() || '';
}

/**
 * Ignores the placeholders sent when an academic program has no registered name.
 *
 * @param code Academic program code.
 * @param values Candidate labels from the dashboard.
 * @returns The first program name available.
 */
function readAcademicProgramName(code: string | undefined, ...values: unknown[]): string {
    const unregisteredProgram = /^Curso\s+(?:desconhecido|\d+|\[\d+\], favor solicitar o cadastro)$/i;

    return values.map(value => text(value))
        .find(label => label && label !== code && !unregisteredProgram.test(label)) || '';
}

/**
 * Keeps publication indicators limited to explicit visibility values from the dashboard API.
 *
 * @param value Raw course visibility field.
 * @returns Known publication state, or undefined when the API did not provide one.
 */
function readPublicationStatus(value: unknown): NativePainelCourse['publicationStatus'] {
    if (value === true || value === 1 || value === '1') {
        return 'published';
    }
    if (value === false || value === 0 || value === '0') {
        return 'unpublished';
    }

    return undefined;
}

/**
 * Reads docent names only from fields already present in the authenticated dashboard payload.
 *
 * @param source Raw course row.
 * @returns Unique lecturer names, an empty string for inactive assignments, or undefined when missing.
 */
function readTeacherNames(source: Record<string, unknown>): string | undefined {
    const turma = object(source['turma']);
    const values = [source['professores'], source['docentes'], turma['professores'], turma['docentes']];
    const names: string[] = [];
    let hasInactiveAssignment = false;
    const add = (value: unknown): void => {
        const record = object(value);
        const status = text(record['situacao_diario'], record['status']).toLowerCase();
        if (status === 'inativo' || status === 'suspenso') {
            hasInactiveAssignment = true;

            return;
        }
        const name = typeof value === 'string' ? text(value)
            : text(record['nome_usual'], record['nome'], record['fullname'], record['name']);
        if (name && !names.includes(name)) {
            names.push(name);
        }
    };

    for (const value of values) {
        if (Array.isArray(value)) {
            value.forEach(add);
        } else if (typeof value === 'string') {
            add(value);
        }
    }
    for (const value of [source['professor'], source['teacher'], turma['professor'], turma['teacher']]) {
        if (value) {
            add(value);
        }
    }

    return names.length || hasInactiveAssignment ? names.join(', ') : undefined;
}

/**
 * Mantém zeros à esquerda de códigos textuais e aceita IDs numéricos da API.
 *
 * @param value Campo do catálogo ou de um curso.
 * @returns ID comparável ou texto vazio quando ausente.
 */
function filterId(value: unknown): string {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? String(value) : text(value);
}

/**
 * Ignora os placeholders de ID vazio usados pelo menu Web.
 *
 * @param raw Catálogo de opções informado pela API.
 * @returns Rótulos indexados por ID.
 */
function filterLabels(raw: unknown): ReadonlyMap<string, string> {
    const labels = new Map<string, string>();
    for (const entry of Array.isArray(raw) ? raw : []) {
        const option = object(entry);
        const id = filterId(option['id']);
        const label = text(option['label']);
        if (id && label) {
            labels.set(id, label);
        }
    }

    return labels;
}

/**
 * Unifica as grafias do mesmo semestre sem alterar o código de curso.
 *
 * @param value Chave do semestre informada pelo AVA.
 * @returns Chave comparável entre ambientes, no formato ano.oferta quando conhecido.
 */
function semesterKey(value: string): string {
    return value.replace(/^(\d{4})[./]?(\d)$/, '$1.$2');
}

/**
 * Lê a etapa curricular apenas no código institucional completo e coerente com os metadados.
 *
 * @param shortname Código curto do diário no Moodle.
 * @param semester Semestre de oferta, quando conhecido.
 * @param academicCourse Código acadêmico, quando conhecido.
 * @returns Dados do código ou null se ele estiver fora do formato ou divergir do cadastro.
 */
function readDiaryCode(shortname: string, semester: string, academicCourse: string): { semester: string; period: string } | null {
    const code = /^(\d{4})(\d)\.(\d+)\.(\d+)\.[\p{L}\p{N}_-]+\.[\p{L}\p{N}_]+\.\d+(?:#\d+)?$/u.exec(shortname);
    if (!code || (semester && semesterKey(semester) !== `${code[1]}.${code[2]}`)
        || (academicCourse && academicCourse !== code[4])) {
        return null;
    }
    const period = Number(code[3]);

    return { semester: `${code[1]}.${code[2]}`, period: Number.isSafeInteger(period) && period > 0 ? String(period) : '' };
}

/**
 * Mantém o identificador acadêmico separado do ID Moodle que abre o cartão.
 *
 * @param source Registro de curso retornado pela API.
 * @param group Aba do Painel à qual o registro pertence.
 * @param labels Rótulos do catálogo da sessão.
 * @returns Valores que podem participar dos filtros locais.
 */
function readCourseFilterOptions(
    source: Record<string, unknown>,
    group: NativePainelGroup,
    labels: FilterLabels,
): NativePainelCourse['filterOptions'] {
    const option = (key: PainelFacet, id: string, fallback = ''): PainelFilterOption | undefined =>
        id ? { id, label: labels[key]?.get(id) || fallback || id } : undefined;
    const academicCourse = object(source['curso']);
    const courseId = filterId(source['curso_codigo']) || filterId(academicCourse['codigo']);
    const discipline = object(source['disciplina']);
    const disciplineId = filterId(source['disciplina_id']) || filterId(discipline['id']);
    const environment = object(source['ambiente']);
    const environmentId = Number(environment['id']);
    const semester = filterId(source['turma_ano_periodo']);
    const diaryCode = group === 'diarios' ? readDiaryCode(text(source['shortname']), semester, courseId) : null;
    const term = semesterKey(semester || diaryCode?.semester || '');
    const moduleId = filterId(source['modulo']);

    return {
        semester: term ? { id: term, label: semesterKey(labels.semester?.get(semester) || term) } : undefined,
        period: diaryCode?.period ? { id: diaryCode.period, label: `${diaryCode.period}º período` } : undefined,
        module: labels.module?.has(moduleId) ? option('module', moduleId) : undefined,
        discipline: option(
            'discipline',
            disciplineId,
            text(source['disciplina_descricao'], discipline['descricao'], source['disciplina_sigla'], source['fullname']),
        ),
        academicCourse: option('academicCourse', courseId, text(academicCourse['nome'], source['curso_descricao'])),
        environment: Number.isSafeInteger(environmentId) && environmentId > 0
            ? option('environment', String(environmentId), text(environment['titulo'], environment['label'])) : undefined,
    };
}

/**
 * Maps the existing owner-validated dashboard; never reads credentials or creates a cache.
 *
 * @param raw Dashboard already checked by PainelAvaService for the current owner.
 * @param profile Current account profile, or null.
 * @param accountIdentity Verified profile identity, used only to scope in-memory UI state.
 * @returns Native view model, or null when dashboard data is absent.
 */
export function buildNativePainelModel(
    raw: unknown,
    profile: Record<string, unknown> | null,
    accountIdentity?: string,
): NativePainelModel | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const envelope = object(raw);
    const labels: FilterLabels = {
        semester: filterLabels(envelope['semestres']),
        module: filterLabels(envelope['modulos']),
        discipline: filterLabels(envelope['disciplinas']),
        academicCourse: filterLabels(envelope['cursos']),
        environment: filterLabels(envelope['ambientes']),
    };
    const groups = Object.fromEntries((['diarios', 'coordenacoes', 'autoinscricoes'] as const).map(group => {
        const rows: unknown = Array.isArray(raw) && group === 'diarios' ? raw : envelope[group];
        const courses = (Array.isArray(rows) ? rows : []).map((row, index): NativePainelCourse => {
            const source = object(row);
            const environment = object(source['ambiente']);
            const discipline = object(source['disciplina']);
            const academicCourse = object(source['curso']);
            const enrolment = object(source['autoinscricao']);
            const id = Number(source['id']); // The API id is Moodle's id, never the SUAP diário id.
            const viewurl = text(source['viewurl'], source['url']);
            const name = text(discipline['descricao'], source['disciplina_descricao'], source['componente_curricular'],
                source['fullname'], source['name'], source['shortname']) || 'Disciplina';
            const shortname = text(source['shortname'], discipline['sigla']);
            const academicCode = text(source['shortname'], source['idnumber'], discipline['sigla']);
            const environmentName = text(environment['titulo'], environment['label']);
            const enrolled = source['is_enrolled'] ?? enrolment['is_enrolled'] ?? group !== 'autoinscricoes';
            const site = resolveCourseSite({ viewurl, environment: environmentName });
            const environmentId = Number(environment['id']);
            const publicationStatus = readPublicationStatus(source['visible']);
            const filterOptions = readCourseFilterOptions(source, group, labels);
            const courseOption = filterOptions.academicCourse;
            const academicProgram = readAcademicProgramName(
                courseOption?.id,
                academicCourse['nome'],
                courseOption && labels.academicCourse?.get(courseOption.id),
                source['curso_nome'],
                source['curso_descricao'],
            );
            const teacherNames = readTeacherNames(source);

            /* eslint-disable @typescript-eslint/naming-convention -- Preserve the existing dashboard API field names. */
            return {
                id: Number.isSafeInteger(id) && id > 0 ? id : 0,
                key: `${group}:${site || 'unknown'}:${id}:${index}`,
                name, fullname: name,
                shortname,
                academicProgram: academicProgram || undefined,
                academicCode: academicCode || undefined,
                teacherNames,
                environment: environmentName || 'AVA',
                isAcademicEnvironment: site === 'https://academico.ava.ifrn.edu.br',
                publicationStatus,
                filterOptions,
                searchableText: normalizePainelSearch(
                    `${academicProgram} ${name} ${academicCode} ${teacherNames ?? ''} ${environmentName || 'AVA'}`,
                ),
                ambiente: { titulo: environmentName, ...(Number.isSafeInteger(environmentId) ? { id: environmentId } : {}) },
                viewurl,
                moodle_course_id: Number.isSafeInteger(id) && id > 0 ? id : undefined,
                moodle_site_url: site,
                details_url: text(enrolment['details_url'], source['details_url'], viewurl),
                is_enrolled: enrolled === true,
                enrolled: enrolled === true,
                isfavourite: source['isfavourite'] === true || source['favourite'] === true,
                progress: typeof source['progress'] === 'number' && Number.isFinite(source['progress'])
                    && source['progress'] >= 0 && source['progress'] <= 100 ? source['progress'] : null,
                hasprogress: source['hasprogress'] === true,
                published: ![false, 0, '0'].includes(source['visible'] as boolean | number | string),
                source: 'painel',
            };
            /* eslint-enable @typescript-eslint/naming-convention */
        });

        return [group, courses];
    })) as NativePainelModel['groups'];
    const name = text(...['nome_exibicao', 'show_name', 'nome_usual', 'nome_social', 'nome_registro', 'nome_completo',
        'nome', 'name', 'display_name'].map(key => profile?.[key])) || 'Estudante';
    const photoValue = text(profile?.['url_foto_150x200'], profile?.['url_foto_75x100'], profile?.['foto']);
    let photo: string | undefined;
    try {
        const url = new URL(photoValue, 'https://suap.ifrn.edu.br');
        if (photoValue && url.protocol === 'https:' && !url.username && !url.password) {
            photo = url.href;
        }
    } catch { /* A missing photo never blocks the dashboard. */ }

    return { name, photo, accountIdentity, groups };
}

/**
 * Applies only the names that were missing from the authenticated dashboard.
 *
 * @param courses Current cards.
 * @param names Names found in the Moodle participants list, by card key.
 * @returns Cards with teacher names added to the display and search.
 */
export function withMoodleTeacherNames(
    courses: readonly NativePainelCourse[],
    names: ReadonlyMap<string, string>,
): NativePainelCourse[] {
    return courses.map(course => {
        const teacherNames = names.get(course.key);
        if (!teacherNames || course.teacherNames !== undefined) {
            return course;
        }

        return { ...course, teacherNames, searchableText: `${course.searchableText} ${normalizePainelSearch(teacherNames)}` };
    });
}
