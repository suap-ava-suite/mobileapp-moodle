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

export type NativePainelGroup = 'diarios' | 'coordenacoes' | 'autoinscricoes';
export interface NativePainelCourse extends DashboardCourse {
    key: string;
    published: boolean;
}
export interface NativePainelModel {
    name: string;
    photo?: string;
    groups: Record<NativePainelGroup, NativePainelCourse[]>;
}

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
 * Maps the existing owner-validated dashboard; never reads credentials or creates a cache.
 *
 * @param raw Dashboard already checked by PainelAvaService for the current owner.
 * @param profile Current account profile, or null.
 * @returns Native view model, or null when dashboard data is absent.
 */
export function buildNativePainelModel(raw: unknown, profile: Record<string, unknown> | null): NativePainelModel | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const envelope = object(raw);
    const groups = Object.fromEntries((['diarios', 'coordenacoes', 'autoinscricoes'] as const).map(group => {
        const rows: unknown = Array.isArray(raw) && group === 'diarios' ? raw : envelope[group];
        const courses = (Array.isArray(rows) ? rows : []).map((row, index): NativePainelCourse => {
            const source = object(row);
            const environment = object(source['ambiente']);
            const discipline = object(source['disciplina']);
            const enrolment = object(source['autoinscricao']);
            const id = Number(source['id']); // The API id is Moodle's id, never the SUAP diário id.
            const viewurl = text(source['viewurl'], source['url']);
            const name = text(source['fullname'], discipline['descricao'], source['shortname']) || 'Disciplina';
            const environmentName = text(environment['titulo'], environment['label']);
            const enrolled = source['is_enrolled'] ?? enrolment['is_enrolled'] ?? group !== 'autoinscricoes';
            const site = resolveCourseSite({ viewurl, environment: environmentName });
            const environmentId = Number(environment['id']);

            /* eslint-disable @typescript-eslint/naming-convention -- Preserve the existing dashboard API field names. */
            return {
                id: Number.isSafeInteger(id) && id > 0 ? id : 0,
                key: `${group}:${site || 'unknown'}:${id}:${index}`,
                name, fullname: name,
                shortname: text(source['shortname'], discipline['sigla']),
                environment: environmentName || 'AVA',
                ambiente: { titulo: environmentName, ...(Number.isSafeInteger(environmentId) ? { id: environmentId } : {}) },
                viewurl,
                moodle_course_id: Number.isSafeInteger(id) && id > 0 ? id : undefined,
                moodle_site_url: site,
                details_url: text(enrolment['details_url'], source['details_url'], viewurl),
                is_enrolled: enrolled === true,
                enrolled: enrolled === true,
                isfavourite: source['isfavourite'] === true || source['favourite'] === true,
                progress: typeof source['progress'] === 'number' ? Math.max(0, Math.min(100, source['progress'])) : null,
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

    return { name, photo, groups };
}
