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

import type { AddonCalendarEventBase, AddonCalendarMonth } from '@addons/calendar/services/calendar';

export type CalendarMonth = { year: number; month: number };
export type CalendarDate = CalendarMonth & { day: number };
export type CalendarSelection = CalendarDate & { courseId: number | null; view: 'month' | 'list' };
export type CalendarCourse = { id: number; name: string };
export type CalendarScope = { owner: string; siteId: string; siteUrl: string; userId: number; courseId: number };
export type CalendarActivity = { courseId: number; moduleId: number; moduleName: string };
export type CalendarEvent = {
    id: number;
    name: string;
    courseId?: number;
    courseName?: string;
    type: string;
    start: number;
    time: string;
    overdue: boolean;
    description?: string;
    activity?: CalendarActivity;
};
export type CalendarDay = { day: number; today: boolean; newEventAt?: number; events: CalendarEvent[] };
export type CalendarMonthView = {
    weekdays: { short: string; label: string }[];
    cells: (CalendarDay | null)[];
    days: CalendarDay[];
};

const UTC = { timeZone: 'UTC' };
const monthFormat = new Intl.DateTimeFormat('pt-BR', { ...UTC, month: 'long', year: 'numeric' });
const dayFormat = new Intl.DateTimeFormat('pt-BR', { ...UTC, dateStyle: 'full' });
const weekShort = new Intl.DateTimeFormat('pt-BR', { ...UTC, weekday: 'short' });
const weekFull = new Intl.DateTimeFormat('pt-BR', { ...UTC, weekday: 'long' });

export function positiveId(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function sameCalendarScope(origin: CalendarScope, current: CalendarScope | undefined): boolean {
    return !!current && current.owner === origin.owner && current.siteId === origin.siteId
        && current.userId === origin.userId && current.siteUrl === origin.siteUrl && current.courseId === origin.courseId;
}

export function isCalendarCoursePath(url: string, courseId: number): boolean {
    return positiveId(courseId)
        && new RegExp(`^/main/[a-z0-9_-]+/course(?:/deep)*/${courseId}(?:/contents)?/?$`).test(url.split(/[?#]/)[0]);
}

export function calendarToday(now = new Date(), timeZone?: string): CalendarDate {
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone, calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: 'numeric', day: 'numeric',
    }).formatToParts(now);

    return {
        year: Number(parts.find(part => part.type === 'year')?.value),
        month: Number(parts.find(part => part.type === 'month')?.value),
        day: Number(parts.find(part => part.type === 'day')?.value),
    };
}

export function calendarTimeZone(value: unknown): string | undefined {
    if (typeof value !== 'string' || !value.trim() || value === '99') {
        return;
    }
    try {
        return new Intl.DateTimeFormat('pt-BR', { timeZone: value }).resolvedOptions().timeZone;
    } catch {
        return;
    }
}

function civilDate({ year, month }: CalendarMonth, day = 1): Date {
    return new Date(Date.UTC(year, month - 1, day, 12));
}

export function shiftCalendarMonth(month: CalendarMonth, step: -1 | 1): CalendarMonth {
    const date = civilDate({ year: month.year, month: month.month + step });

    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function calendarMonthLabel(month: CalendarMonth): string {
    return monthFormat.format(civilDate(month));
}

export function calendarDayLabel(date: CalendarDate): string {
    return dayFormat.format(civilDate(date, date.day));
}

export function sameCalendarMonth(a: CalendarMonth, b: CalendarMonth): boolean {
    return a.year === b.year && a.month === b.month;
}

/** Converte somente caminhos de atividades do mesmo AVA em identificadores nativos. */
export function calendarActivity(
    value: unknown,
    siteUrl: string,
    courseId: number | undefined,
    moduleName?: string,
): CalendarActivity | undefined {
    if (typeof value !== 'string' || !value || !positiveId(courseId)) {
        return;
    }
    try {
        const base = new URL(siteUrl);
        const link = new URL(value, `${siteUrl.replace(/\/+$/, '')}/`);
        const root = base.pathname.replace(/\/+$/, '');
        if (base.protocol !== 'https:' || link.origin !== base.origin || link.username || link.password
            || !link.pathname.startsWith(`${root}/`)) {
            return;
        }
        const match = /^\/mod\/([a-z][a-z0-9_]*)\/view\.php$/.exec(link.pathname.slice(root.length));
        const ids = link.searchParams.getAll('id');
        const moduleId = Number(ids[0]);
        if (!match || (moduleName && moduleName !== match[1]) || ids.length !== 1 || !/^\d+$/.test(ids[0])
            || !positiveId(moduleId)) {
            return;
        }

        return { courseId, moduleId, moduleName: match[1] };
    } catch {
        return;
    }
}

/** Usa a classificação e o texto de horário já calculados pelo Moodle para o usuário. */
export function calendarEvent(
    event: AddonCalendarEventBase,
    scope: CalendarScope,
    courseId: number | null,
    plainText: (value?: string) => string,
): CalendarEvent | undefined {
    if (!event || !positiveId(event.id) || typeof event.name !== 'string') {
        return;
    }
    const eventCourse = positiveId(event.course?.id) ? event.course.id : undefined;
    const type = event.normalisedeventtype || event.eventtype;
    if ((courseId !== null && eventCourse !== courseId)
        || (type === 'user' && positiveId(event.userid) && event.userid !== scope.userId)) {
        return;
    }
    const name = plainText(event.name);
    if (!name) {
        return;
    }

    return {
        id: event.id, name, courseId: eventCourse, courseName: plainText(event.course?.fullname) || undefined,
        type, start: Number.isFinite(event.timestart) ? event.timestart : 0,
        time: plainText(event.formattedtime), overdue: event.overdue === true,
        description: typeof event.description === 'string' ? event.description : undefined,
        activity: calendarActivity(event.url, scope.siteUrl, eventCourse, event.modulename),
    };
}

/** Mantém os agrupamentos de eventos por dia fornecidos pelo servidor, inclusive eventos de vários dias. */
export function calendarMonthView(
    response: AddonCalendarMonth,
    month: CalendarMonth,
    today: CalendarDate,
    scope: CalendarScope,
    courseId: number | null,
    plainText: (value?: string) => string,
): CalendarMonthView {
    if (!response || !Array.isArray(response.weeks) || response.date?.year !== month.year || response.date.mon !== month.month) {
        throw new Error('Resposta mensal inválida');
    }
    const startingDay = response.daynames?.[0]?.dayno;
    const first = Number.isInteger(startingDay) && startingDay >= 0 && startingDay < 7 ? startingDay : 0;
    const weekdays = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(Date.UTC(2024, 0, 7 + (first + i) % 7, 12));

        return { short: weekShort.format(date).replace(/\.$/, ''), label: weekFull.format(date) };
    });
    const last = civilDate({ year: month.year, month: month.month + 1 }, 0).getUTCDate();
    const source = new Map(response.weeks.flatMap(week => week.days).map(day => [day.mday, day]));
    const days = Array.from({ length: last }, (_, i): CalendarDay => {
        const day = i + 1;
        const serverDay = source.get(day);
        const entries = new Map<number, CalendarEvent>();
        for (const raw of serverDay?.events ?? []) {
            const event = calendarEvent(raw, scope, courseId, plainText);
            if (event && !entries.has(event.id)) {
                entries.set(event.id, event);
            }
        }

        return {
            day,
            today: serverDay?.istoday ?? (sameCalendarMonth(month, today) && day === today.day),
            newEventAt: positiveId(serverDay?.neweventtimestamp) ? serverDay.neweventtimestamp * 1000 : undefined,
            events: [...entries.values()].sort((a, b) => a.start - b.start || a.id - b.id),
        };
    });
    const padding = (civilDate(month).getUTCDay() - first + 7) % 7;
    const tail = (7 - (padding + last) % 7) % 7;

    return { weekdays, days, cells: [...Array<null>(padding).fill(null), ...days, ...Array<null>(tail).fill(null)] };
}

export function calendarEventKind(event: CalendarEvent): { label: string; icon: string } {
    if (event.activity) {
        return { label: 'Atividade', icon: 'fas-clipboard-list' };
    }
    switch (event.type) {
        case 'course': return { label: 'Disciplina', icon: 'fas-graduation-cap' };
        case 'group': return { label: 'Grupo', icon: 'fas-users' };
        case 'user': return { label: 'Pessoal', icon: 'fas-user' };
        case 'site': return { label: 'Institucional', icon: 'fas-globe' };
        case 'category': return { label: 'Categoria', icon: 'fas-layer-group' };
        default: return { label: 'Evento', icon: 'fas-calendar-day' };
    }
}

/** Na lista mensal, cada ID aparece uma vez, mesmo quando o Moodle o inclui em vários dias. */
export function calendarListDays(days: CalendarDay[]): CalendarDay[] {
    const seen = new Set<number>();

    return days.map(day => ({
        ...day,
        events: day.events.filter(event => {
            if (seen.has(event.id)) {
                return false;
            }
            seen.add(event.id);

            return true;
        }),
    })).filter(day => day.events.length > 0);
}
