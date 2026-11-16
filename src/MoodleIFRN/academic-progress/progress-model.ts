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
export interface ActivityCompletion {
    cmid: number;
    tracking: number;
    state: number;
    hascompletion?: boolean;
    istrackeduser?: boolean;
    uservisible?: boolean;
    isoverallcomplete?: boolean;
    offline?: boolean;
    details?: { rulename: string; rulevalue: { status: number; description: string } }[];
}

export interface ProgressContext {
    owner: string;
    siteId: string;
    siteUrl: string;
    userId: number;
    courseId: number;
}

export interface ProgressSnapshot {
    status: 'loading' | 'ready' | 'disabled' | 'empty' | 'unavailable' | 'stale';
    percent: number | null;
    completed: number | null;
    total: number | null;
    activityPercent: number | null;
    source: 'moodle' | 'painel' | 'activities';
    activities: readonly ActivityCompletion[];
    confirmedAt: number | null;
}

export interface ProgressPayload {
    enabled: boolean;
    percent: number | null;
    activities?: readonly ActivityCompletion[];
}

export interface ActivityLabel {
    text: string;
    icon: string;
    completed: boolean;
    tracking: string;
}

/**
 * Isola o cache em memória. A chave contém identidade e não deve ser registrada em logs.
 *
 * @param context Contexto validado pelo adaptador de sessão.
 * @returns Chave composta, exclusiva desta conta, ambiente e disciplina.
 */
export function contextKey(context: ProgressContext): string {
    return JSON.stringify([context.owner, context.siteUrl, context.siteId, context.userId, context.courseId]);
}

/**
 * Valida percentuais sem converter strings nem limitar dados inválidos a zero/cem.
 *
 * @param value Campo recebido do servidor.
 * @returns Percentual válido ou ausência de informação.
 */
export function validPercent(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

/**
 * Representa estados sem medição acadêmica disponível.
 *
 * @param status Estado de disponibilidade para a apresentação.
 * @returns Snapshot sem porcentagem inventada.
 */
export function unavailableProgress(status: ProgressSnapshot['status'] = 'unavailable'): ProgressSnapshot {
    return { status, percent: null, completed: null, total: null, activityPercent: null,
        source: 'moodle', activities: [], confirmedAt: null };
}

/**
 * Nunca transforma ausência de informação em zero. O agregado do Painel não contém contagens.
 *
 * @param percent Agregado oficial recebido pelo Painel.
 * @param hasProgress Disponibilidade informada pelo contrato do Painel.
 * @returns Agregado marcado como último valor recebido, sem inventar contagens.
 */
export function panelProgress(percent: unknown, hasProgress: boolean): ProgressSnapshot {
    const value = hasProgress ? validPercent(percent) : null;

    return { ...unavailableProgress(), status: value === null ? 'unavailable' : 'stale',
        percent: value, source: 'painel' };
}

/**
 * Seleciona atividades rastreadas; uma restrição de acesso não elimina o critério acadêmico.
 *
 * @param activity Estado de conclusão retornado pelo Moodle.
 * @returns Se a atividade participa da contagem de conclusão.
 */
export function isEligible(activity: ActivityCompletion): boolean {
    return (activity.tracking === 1 || activity.tracking === 2)
        && activity.hascompletion !== false && activity.istrackeduser !== false;
}

/**
 * Respeita a conclusão global da atividade e os estados de sucesso oficiais.
 *
 * @param activity Estado recebido do Moodle, sem sobreposição otimista offline.
 * @returns Se há conclusão confirmada, independente do acesso à página.
 */
export function isConfirmedComplete(activity: ActivityCompletion): boolean {
    return isEligible(activity) && !activity.offline
        && (activity.isoverallcomplete === true || activity.state === 1 || activity.state === 2);
}

/**
 * Os valores seguem os estados oficiais, sem deduzir envio, acesso ou nota a partir de state=0.
 *
 * @param activity Estado da atividade, quando disponível.
 * @returns Texto e ícone; nota oculta e dados ausentes não são revelados/inventados.
 */
export function activityLabel(activity?: ActivityCompletion): ActivityLabel {
    const tracking = activity?.tracking === 1 ? 'Conclusão manual' : activity?.tracking === 2 ? 'Conclusão automática' : '';
    const label = (text: string, icon: string, completed = false): ActivityLabel => ({ text, icon, completed, tracking });
    if (!activity) { return label('Estado indisponível', 'help-circle-outline'); }
    if (!isEligible(activity)) { return label('Sem acompanhamento de conclusão', 'remove-circle-outline'); }
    if (activity.offline) { return label('Pendente de sincronização', 'cloud-upload-outline'); }
    if (isConfirmedComplete(activity)) {
        return label(activity.state === 2 ? 'Concluído · aprovado' : 'Concluído', 'checkmark-circle-outline', true);
    }
    if (activity.state === 3) { return label('Não aprovado', 'alert-circle-outline'); }

    return label('Pendente', 'ellipse-outline');
}

/**
 * Mantém o agregado do servidor separado da fração das atividades elegíveis.
 *
 * @param payload Dados oficiais de leitura.
 * @param now Instante da confirmação desta leitura.
 * @returns Progresso e contagens com indicação da fonte e disponibilidade.
 */
export function summarizeProgress(payload: ProgressPayload, now: number): ProgressSnapshot {
    if (!payload.enabled) { return unavailableProgress('disabled'); }
    const percent = validPercent(payload.percent);
    const activities = payload.activities ? [...payload.activities] : [];
    const eligible = activities.filter(isEligible);
    const completed = eligible.filter(isConfirmedComplete).length;
    const activityPercent = eligible.length ? completed / eligible.length * 100 : null;
    const value = percent ?? activityPercent;

    return {
        status: value !== null ? 'ready' : payload.activities ? 'empty' : 'unavailable',
        percent: value,
        completed: payload.activities ? completed : null,
        total: payload.activities ? eligible.length : null,
        activityPercent,
        source: percent === null ? 'activities' : 'moodle',
        activities,
        confirmedAt: now,
    };
}

/**
 * Falha fechada: respostas parciais/malformadas não viram progresso acadêmico.
 *
 * @param value Mapa de estados recebido pelo adaptador Moodle.
 * @returns Estados validados, sem duplicar uma atividade no denominador.
 */
export function validateActivities(value: unknown): ActivityCompletion[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { throw new Error('Invalid completion schema'); }
    const rows = Object.values(value) as ActivityCompletion[];
    const seen = new Set<number>();
    for (const row of rows) {
        if (!row || !Number.isSafeInteger(row.cmid) || row.cmid <= 0 || seen.has(row.cmid)
            || ![0, 1, 2].includes(row.tracking) || ![0, 1, 2, 3, 4].includes(row.state)) {
            throw new Error('Invalid completion schema');
        }
        seen.add(row.cmid);
    }

    return rows;
}

/**
 * Limita atualizações às telas visíveis, preservando componentes retidos pelo Ionic.
 *
 * @param url Rota local do Angular Router.
 * @param courseId Curso desejado; ausência seleciona somente o Painel.
 * @returns Se o consumidor pode atualizar nesta rota.
 */
export function isProgressRoute(url: string, courseId?: number): boolean {
    const path = url.split(/[?#]/)[0].replace(/\/$/, '');
    if (courseId === undefined) { return path === '/login/painel'; }

    return new RegExp(`/course(?:/deep)*/${courseId}(?:/contents)?$`).test(path);
}
