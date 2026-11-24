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

import { Injectable, OnDestroy, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ADDON_CALENDAR_PAGE_NAME } from '@addons/calendar/constants';
import { CoreNavigator } from '@services/navigator';
import { CoreModals } from '@services/overlays/modals';
import { CoreAlerts } from '@services/overlays/alerts';
import { CoreEvents } from '@static/events';
import { ModalController } from '@singletons';
import { IfrnCalendarDataService, type OpenCalendarActivity } from './calendar-data.service';
import { isCalendarCoursePath, type CalendarScope, type CalendarSelection } from './calendar-model';

export type CalendarExit = {
    selection: CalendarSelection;
} & ({ type: 'create'; timestamp?: number } | { type: 'activity'; moduleName: string; open: OpenCalendarActivity });

export type CalendarModalResult = { modalId: string; exit: CalendarExit };

type CalendarJourney = {
    id: string;
    scope: CalendarScope;
    origin: string;
    tab: string;
    courseName: string;
    lease: AbortController;
    cleanups: (() => void)[];
    selection?: CalendarSelection;
    away?: { path: string; entered: boolean };
};

let modalSequence = 0;

/**
 * Mantém o curso na pilha Ionic. O editor e as atividades continuam sendo
 * páginas do Moodle; a seleção é retomada ao voltar à rota de origem.
 */
@Injectable()
export class IfrnCalendarNavigationService implements OnDestroy {

    private readonly router = inject(Router);
    private readonly data = inject(IfrnCalendarDataService);
    private current?: CalendarJourney;

    get available(): boolean {
        return this.data.isAvailable();
    }

    async open(courseId: number, name?: string): Promise<void> {
        const scope = this.data.scope(courseId);
        const origin = CoreNavigator.getCurrentPath();
        const tab = CoreNavigator.getCurrentMainMenuTab();
        if (!scope || !tab || !isCalendarCoursePath(origin, courseId)) {
            await CoreAlerts.showError('Não foi possível confirmar a sessão desta disciplina. Volte ao Painel e reabra o curso.');

            return;
        }
        if (this.current && !this.current.away) {
            return;
        }
        this.finish();
        const journey: CalendarJourney = {
            id: `ifrn-course-calendar-${++modalSequence}`, scope, origin, tab,
            courseName: this.data.plainText(name), lease: new AbortController(), cleanups: [],
        };
        this.current = journey;
        this.watch(journey);
        await this.present(journey);
    }

    ngOnDestroy(): void {
        this.finish();
    }

    private watch(journey: CalendarJourney): void {
        const sub = this.router.events.subscribe(event => {
            if (event instanceof NavigationEnd && this.current === journey) {
                this.routeChanged(journey, CoreNavigator.getCurrentPath());
            }
        });
        journey.cleanups.push(() => sub.unsubscribe());
        const changed = (): void => {
            if (!this.data.isActive(journey.scope)) {
                this.finish();
            }
        };
        for (const event of [CoreEvents.LOGOUT, CoreEvents.SESSION_EXPIRED]) {
            const observer = CoreEvents.on(event, () => this.finish(), journey.scope.siteId);
            journey.cleanups.push(() => observer.off());
        }
        const login = CoreEvents.on(CoreEvents.LOGIN, changed);
        const siteUpdated = CoreEvents.on(CoreEvents.SITE_UPDATED, changed, journey.scope.siteId);
        window.addEventListener('storage', changed);
        document.addEventListener('resume', changed);
        journey.cleanups.push(
            () => login.off(),
            () => siteUpdated.off(),
            () => window.removeEventListener('storage', changed),
            () => document.removeEventListener('resume', changed),
        );
    }

    private routeChanged(journey: CalendarJourney, path: string): void {
        if (!this.data.isActive(journey.scope)) {
            this.finish();

            return;
        }
        const away = journey.away;
        if (path === journey.origin) {
            if (away?.entered) {
                journey.away = undefined;
                void this.present(journey, true);
            }

            return;
        }
        if (away && (path === away.path || path.startsWith(`${away.path}/`))) {
            away.entered = true;
        } else {
            this.finish();
        }
    }

    private validOrigin(journey: CalendarJourney): boolean {
        return this.current === journey && this.data.isActive(journey.scope) && CoreNavigator.getCurrentPath() === journey.origin;
    }

    private async present(journey: CalendarJourney, refresh = false): Promise<void> {
        try {
            const { IfrnCourseCalendarComponent } = await import('./course-calendar.component');
            if (!this.validOrigin(journey)) {
                return;
            }
            const result = await CoreModals.openModal<CalendarModalResult>({
                id: journey.id,
                component: IfrnCourseCalendarComponent,
                componentProps: {
                    modalId: journey.id,
                    scope: journey.scope,
                    courseName: journey.courseName,
                    initialSelection: journey.selection,
                    journeySignal: journey.lease.signal,
                    refreshOnEnter: refresh,
                },
                htmlAttributes: { 'aria-label': 'Calendário acadêmico' },
                waitForDismissCompleted: true,
            });
            if (result?.modalId !== journey.id || !this.validOrigin(journey)) {
                if (this.current === journey) {
                    this.finish();
                }

                return;
            }
            await this.openDestination(journey, result.exit);
        } catch {
            if (this.validOrigin(journey)) {
                this.finish();
                await CoreAlerts.showError('Não foi possível abrir esta opção do calendário. Tente novamente.');
            }
        }
    }

    private async openDestination(journey: CalendarJourney, result: CalendarExit): Promise<void> {
        journey.selection = result.selection;
        const tab = `/main/${journey.tab}`;
        if (result.type === 'create') {
            const path = `${tab}/${ADDON_CALENDAR_PAGE_NAME}/edit/0`;
            journey.away = { path, entered: false };
            if (!await CoreNavigator.navigate(path, {
                params: { courseId: result.selection.courseId ?? undefined, timestamp: result.timestamp },
            })) {
                throw new Error('Editor indisponível');
            }
        } else {
            journey.away = { path: `${tab}/mod_${result.moduleName}`, entered: false };
            await result.open();
        }
        if (this.validOrigin(journey) && journey.away && !journey.away.entered) {
            throw new Error('Destino nativo indisponível');
        }
    }

    private finish(): void {
        const journey = this.current;
        this.current = undefined;
        if (!journey) {
            return;
        }
        journey.lease.abort();
        journey.cleanups.forEach(cleanup => cleanup());
        void ModalController.dismiss(undefined, undefined, journey.id).catch(() => undefined);
    }

}
