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

import { Injectable, inject } from '@angular/core';
import { AddonCalendar, type AddonCalendarMonth } from '@addons/calendar/services/calendar';
import { AddonCalendarHelper } from '@addons/calendar/services/calendar-helper';
import { ADDONS_CALENDAR_MENU_FEATURE_NAME } from '@addons/calendar/constants';
import { CoreCourses } from '@features/courses/services/courses';
import { CoreCourse } from '@features/course/services/course';
import { CoreCourseModuleDelegate } from '@features/course/services/module-delegate';
import { CoreUser } from '@features/user/services/user';
import { CoreSites } from '@services/sites';
import { CoreText } from '@static/text';
import { MoodleSiteService } from '../services_mobile/moodle-site.service';
import {
    calendarEvent, calendarTimeZone, positiveId, sameCalendarScope,
    type CalendarActivity, type CalendarCourse, type CalendarEvent, type CalendarMonth, type CalendarScope,
} from './calendar-model';

const MONTH_WS = 'core_calendar_get_calendar_monthly_view';
const DETAIL_WS = 'core_calendar_get_calendar_event_by_id';
const TYPES_WS = 'core_calendar_get_allowed_event_types';
const CREATE_WS = 'core_calendar_submit_create_update_form';

export type OpenCalendarActivity = () => Promise<void> | void;

/** Usa os serviços e o cache do Moodle sem ativar sites ou iniciar autenticação. */
@Injectable({ providedIn: 'root' })
export class IfrnCalendarDataService {

    private readonly moodle = inject(MoodleSiteService);

    isAvailable(): boolean {
        const site = CoreSites.getCurrentSite();

        return !!site && !site.isLoggedOut() && !site.isFeatureDisabled(ADDONS_CALENDAR_MENU_FEATURE_NAME)
            && site.wsAvailable(MONTH_WS);
    }

    scope(courseId: number): CalendarScope | undefined {
        const site = CoreSites.getCurrentSite();
        const owner = this.panelOwner();
        if (!site || !owner || !this.isAvailable() || !positiveId(courseId) || !positiveId(site.getUserId())) {
            return;
        }
        const siteUrl = site.getURL().replace(/\/+$/, '');
        if (!this.moodle.hasMatchingPresencialSession(siteUrl)) {
            return;
        }

        return { owner, siteId: site.getId(), siteUrl, userId: site.getUserId(), courseId };
    }

    isActive(scope: CalendarScope): boolean {
        return sameCalendarScope(scope, this.scope(scope.courseId));
    }

    loadMonth(scope: CalendarScope, month: CalendarMonth, courseId: number | null, refresh: boolean): Promise<AddonCalendarMonth> {
        this.requireScope(scope);

        return AddonCalendar.getMonthlyEvents(month.year, month.month, courseId ?? undefined, undefined, refresh, scope.siteId);
    }

    async courses(scope: CalendarScope): Promise<CalendarCourse[]> {
        const site = this.requireScope(scope);
        if (!site.wsAvailable('core_enrol_get_users_courses')) {
            return [];
        }
        const courses = await CoreCourses.getUserCourses(true, scope.siteId);

        this.requireScope(scope);

        return [...new Map(courses
            .filter(course => positiveId(course.id) && course.visible !== 0 && course.id !== site.getSiteHomeId())
            .map(course => [course.id, { id: course.id, name: this.plainText(course.fullname) }])).values()];
    }

    async timeZone(scope: CalendarScope): Promise<string | undefined> {
        const site = this.requireScope(scope);
        const fallback = calendarTimeZone(site.getStoredConfig('timezone'));
        if (!site.wsAvailable('core_user_get_users_by_field')) {
            return fallback;
        }
        const profile = await CoreUser.getProfile(scope.userId, undefined, false, scope.siteId).catch(() => undefined);
        this.requireScope(scope);

        return (profile && 'timezone' in profile ? calendarTimeZone(profile.timezone) : undefined) ?? fallback;
    }

    async canCreate(scope: CalendarScope, courseId: number | null): Promise<boolean> {
        const site = this.requireScope(scope);
        if (!site.wsAvailable(TYPES_WS) || !site.wsAvailable(CREATE_WS)) {
            return false;
        }
        const allowed = await AddonCalendarHelper.canEditEvents(courseId ?? undefined, scope.siteId);

        return this.isActive(scope) && allowed;
    }

    async detail(scope: CalendarScope, event: CalendarEvent): Promise<CalendarEvent> {
        const site = this.requireScope(scope);
        if (!site.wsAvailable(DETAIL_WS)) {
            return event;
        }
        // Com filter:false o serviço nativo não recorre à BD do site corrente se o WS falhar.
        const raw = await AddonCalendar.getEventById(event.id, { siteId: scope.siteId, filter: false });
        this.requireScope(scope);
        const result = calendarEvent(raw, scope, event.courseId ?? null, this.plainText);
        if (result?.id !== event.id || result.courseId !== event.courseId) {
            throw new Error('Evento fora do contexto do calendário');
        }

        return { ...result, description: result.description ?? event.description, activity: result.activity ?? event.activity };
    }

    async prepareActivity(scope: CalendarScope, target: CalendarActivity): Promise<OpenCalendarActivity> {
        this.requireScope(scope);
        const module = await CoreCourse.getModule(target.moduleId, target.courseId, undefined, false, false, scope.siteId);
        this.requireScope(scope);
        if (module.id !== target.moduleId || module.course !== target.courseId || module.modname !== target.moduleName
            || module.uservisible === false) {
            throw new Error('Atividade indisponível');
        }
        const { modname, section } = module;
        const handler = await CoreCourseModuleDelegate.getModuleDataFor(modname, module, target.courseId, section, false);
        if (!handler?.action) {
            throw new Error('Atividade indisponível');
        }
        this.requireScope(scope);

        return () => {
            this.requireScope(scope);

            return CoreCourseModuleDelegate.openActivityPage(modname, module, target.courseId, {
                siteId: scope.siteId, preferCurrentTab: true,
            });
        };
    }

    readonly plainText = (value?: string): string => typeof value === 'string'
        ? CoreText.cleanTags(value, { singleLine: true, trim: true })
        : '';

    private requireScope(scope: CalendarScope): NonNullable<ReturnType<typeof CoreSites.getCurrentSite>> {
        const site = CoreSites.getCurrentSite();
        if (!site || !this.isActive(scope)) {
            throw new Error('Sessão do calendário encerrada');
        }

        return site;
    }

    private panelOwner(): string {
        try {
            const read = (key: string): string =>
                (sessionStorage.getItem(key) || localStorage.getItem(key) || '').trim().toLowerCase();
            const username = read('ifrn_username');

            return username && username === read('ifrn_painel_owner') ? username : '';
        } catch {
            return '';
        }
    }

}
