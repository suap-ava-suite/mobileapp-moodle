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

import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import type { IonModal } from '@ionic/angular';
import { CoreSharedModule } from '@/core/shared.module';
import { CoreNetwork } from '@services/network';
import { ModalController } from '@singletons';
import { IfrnCalendarDataService } from './calendar-data.service';
import {
    calendarDayLabel, calendarEventKind, calendarListDays, calendarMonthLabel, calendarMonthView, calendarToday,
    sameCalendarMonth, shiftCalendarMonth,
    type CalendarCourse, type CalendarDay, type CalendarEvent, type CalendarMonthView, type CalendarScope, type CalendarSelection,
} from './calendar-model';
import type { CalendarExit, CalendarModalResult } from './calendar-navigation.service';
import { CalendarPendingReads, CalendarReadTimeout, calendarAccessDenied, calendarRead } from './calendar-read';
import type { AddonCalendarMonth } from '@addons/calendar/services/calendar';

const TIME_ZONE_WAIT = 2_500;
const CHECK_SESSION = 'Não foi possível confirmar o acesso. Volte ao curso e verifique sua sessão.';

@Component({
    selector: 'ifrn-course-calendar',
    standalone: true,
    imports: [CoreSharedModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './course-calendar.component.html',
    styleUrls: ['./course-calendar.component.scss'],
})
export class IfrnCourseCalendarComponent implements OnInit, OnDestroy {

    @Input({ required: true }) modalId!: string;
    @Input({ required: true }) scope!: CalendarScope;
    @Input({ required: true }) journeySignal!: AbortSignal;
    @Input() courseName = '';
    @Input() initialSelection?: CalendarSelection;
    @Input() refreshOnEnter = false;

    readonly selection = signal<CalendarSelection>({ ...calendarToday(), courseId: null, view: 'month' });
    readonly monthView = signal<CalendarMonthView | undefined>(undefined);
    readonly today = signal(calendarToday());
    readonly courses = signal<CalendarCourse[]>([]);
    readonly initialized = signal(false);
    readonly loading = signal(true);
    readonly error = signal('');
    readonly canCreate = signal(false);
    readonly detail = signal<CalendarEvent | undefined>(undefined);
    readonly detailLoading = signal(false);
    readonly detailNotice = signal('');
    readonly actionPending = signal(false);
    readonly isOnline = CoreNetwork.onlineSignal;

    readonly monthLabel = computed(() => calendarMonthLabel(this.selection()));
    readonly dayLabel = computed(() => calendarDayLabel(this.selection()));
    readonly selectedCourseName = computed(() => {
        const courseId = this.selection().courseId;

        return courseId === null
            ? 'Todos os cursos deste AVA'
            : this.courses().find(course => course.id === courseId)?.name || 'Disciplina atual';
    });

    readonly displayedDays = computed(() => {
        const days = this.monthView()?.days ?? [];

        return this.selection().view === 'list' ? calendarListDays(days) : days.filter(day => day.day === this.selection().day);
    });

    readonly hasMonthEvents = computed(() => this.monthView()?.days.some(day => day.events.length > 0) ?? false);
    readonly eventKind = calendarEventKind;

    private readonly data = inject(IfrnCalendarDataService);
    private readonly detailModal = viewChild<IonModal>('detailModal');
    private readonly life = new AbortController();
    private readonly pendingMonths = new CalendarPendingReads<AddonCalendarMonth>();
    private timeZone?: string;
    private monthRevision = 0;
    private detailRevision = 0;
    private permissionRevision = 0;
    private accessDenied = false;
    private readonly sessionEnded = (): void => { void this.close(); };

    ngOnInit(): void {
        if (!this.active()) {
            void this.close();

            return;
        }
        this.journeySignal.addEventListener('abort', this.sessionEnded, { once: true });
        void this.initialize();
    }

    ngOnDestroy(): void {
        this.journeySignal?.removeEventListener('abort', this.sessionEnded);
        this.life.abort();
    }

    async close(): Promise<void> {
        this.life.abort();
        this.monthView.set(undefined);
        this.courses.set([]);
        this.canCreate.set(false);
        this.closeDetail();
        this.loading.set(false);
        await this.detailModal()?.dismiss().catch(() => false);
        await ModalController.dismiss(undefined, undefined, this.modalId).catch(() => false);
    }

    moveMonth(step: -1 | 1): void {
        if (!this.initialized() || !this.active()) {
            return;
        }
        const month = shiftCalendarMonth(this.selection(), step);
        const today = this.today();
        this.selection.update(selection => ({ ...selection, ...month, day: sameCalendarMonth(month, today) ? today.day : 1 }));
        void this.loadMonth();
    }

    currentMonth(): void {
        if (!this.initialized() || !this.active()) {
            return;
        }
        const today = calendarToday(new Date(), this.timeZone);
        const previous = this.today();
        const dateChanged = !sameCalendarMonth(today, previous) || today.day !== previous.day;
        this.today.set(today);
        const reload = dateChanged || !sameCalendarMonth(today, this.selection()) || !this.monthView();
        this.selection.update(selection => ({ ...selection, ...today }));
        if (reload) {
            void this.loadMonth(dateChanged && this.isOnline());
        }
    }

    selectDay(day: number): void {
        if (this.monthView()?.days.some(date => date.day === day) && this.active()) {
            this.selection.update(selection => ({ ...selection, day }));
        }
    }

    chooseCourse(value: string): void {
        const courseId = value === '' ? null : Number(value);
        if (!this.initialized() || !this.active() || this.selection().courseId === courseId
            || (courseId !== null && !this.courses().some(course => course.id === courseId))) {
            return;
        }
        this.selection.update(selection => ({ ...selection, courseId }));
        void this.loadMonth();
        void this.loadPermission();
    }

    chooseView(view: CalendarSelection['view']): void {
        this.selection.update(selection => ({ ...selection, view }));
    }

    dayDescription(day: CalendarDay): string {
        const count = day.events.length;
        const date = calendarDayLabel({ ...this.selection(), day: day.day });

        return `${date}, ${count} ${count === 1 ? 'evento' : 'eventos'}`;
    }

    dateLabel(day: number): string {
        return calendarDayLabel({ ...this.selection(), day });
    }

    async loadMonth(refresh = false): Promise<void> {
        const revision = ++this.monthRevision;
        if (!this.active() || (this.accessDenied && !this.isOnline())) {
            this.denyAccess();

            return;
        }
        const selection = this.selection();
        const fromServer = refresh || this.accessDenied;
        const key = JSON.stringify([selection.year, selection.month, selection.courseId, fromServer]);
        this.monthView.set(undefined);
        this.error.set('');
        this.loading.set(true);
        try {
            const load = () => this.data.loadMonth(this.scope, selection, selection.courseId, fromServer);
            const response = await this.pendingMonths.get(key, () => calendarRead(load, this.life.signal));
            if (revision === this.monthRevision && this.active()) {
                const today = this.today();
                const view = calendarMonthView(response, selection, today, this.scope, selection.courseId, this.data.plainText);
                this.monthView.set(view);
                if (this.accessDenied) {
                    this.accessDenied = false;
                    void this.loadPermission();
                }
            }
        } catch (error) {
            if (revision === this.monthRevision && this.active()) {
                if (calendarAccessDenied(error)) {
                    this.denyAccess();
                } else {
                    this.error.set(error instanceof CalendarReadTimeout
                        ? 'O calendário demorou a responder. Tente novamente.'
                        : 'Não foi possível carregar os eventos. Verifique a conexão e tente novamente.');
                }
            }
        } finally {
            if (revision === this.monthRevision && !this.life.signal.aborted) {
                this.loading.set(false);
                if (!this.active()) {
                    this.denyAccess();
                }
            }
        }
    }

    async refresh(refresher?: HTMLIonRefresherElement): Promise<void> {
        try {
            await this.loadMonth(this.isOnline());
        } finally {
            await refresher?.complete();
        }
    }

    async openEvent(event: CalendarEvent, day: number): Promise<void> {
        const match = this.monthView()?.days.find(date => date.day === day)?.events.includes(event);
        if (!match || !this.active() || this.detail()) {
            return;
        }
        const revision = ++this.detailRevision;
        this.selectDay(day);
        this.detail.set(event);
        this.detailNotice.set('');
        this.detailLoading.set(true);
        try {
            const detail = await calendarRead(() => this.data.detail(this.scope, event), this.life.signal);
            if (revision === this.detailRevision && this.active()) {
                this.detail.set(detail);
            }
        } catch (error) {
            if (revision === this.detailRevision && this.active()) {
                if (calendarAccessDenied(error)) {
                    this.denyAccess();
                } else {
                    this.detailNotice.set('Mostrando os dados deste evento que vieram com o calendário.');
                }
            }
        } finally {
            if (revision === this.detailRevision && !this.life.signal.aborted) {
                this.detailLoading.set(false);
            }
        }
    }

    closeDetail(): void {
        ++this.detailRevision;
        this.detail.set(undefined);
        this.detailLoading.set(false);
        this.detailNotice.set('');
    }

    async newEvent(): Promise<void> {
        if (!this.canCreate() || !this.isOnline() || !this.active() || this.actionPending()) {
            return;
        }
        const selection = this.selection();
        const timestamp = this.monthView()?.days.find(day => day.day === selection.day)?.newEventAt;
        await this.leave({ type: 'create', selection, timestamp });
    }

    async openActivity(): Promise<void> {
        const activity = this.detail()?.activity;
        if (!activity || this.detailLoading() || !this.active() || this.actionPending()) {
            return;
        }
        this.actionPending.set(true);
        const revision = this.detailRevision;
        const selection = this.selection();
        try {
            const open = await calendarRead(() => this.data.prepareActivity(this.scope, activity), this.life.signal);
            if (revision === this.detailRevision && this.active()) {
                const modal = this.detailModal();
                if (modal && !await modal.dismiss()) {
                    return;
                }
                if (this.active()) {
                    await this.leave({ type: 'activity', moduleName: activity.moduleName, open, selection });
                }
            }
        } catch (error) {
            if (revision === this.detailRevision && this.active()) {
                if (calendarAccessDenied(error)) {
                    this.denyAccess();
                } else {
                    this.detailNotice.set('Esta atividade não está disponível no aplicativo.');
                }
            }
        } finally {
            if (!this.life.signal.aborted) {
                this.actionPending.set(false);
            }
        }
    }

    private async initialize(): Promise<void> {
        this.courses.set([{ id: this.scope.courseId, name: this.courseName || 'Disciplina atual' }]);
        const options = this.loadCourses();
        this.timeZone = await calendarRead(() => this.data.timeZone(this.scope), this.life.signal, TIME_ZONE_WAIT)
            .catch(() => undefined);
        const preserved = this.initialSelection;
        if (preserved?.courseId && preserved.courseId !== this.scope.courseId) {
            await options;
        }
        if (!this.active()) {
            this.denyAccess();

            return;
        }
        const today = calendarToday(new Date(), this.timeZone);
        this.today.set(today);
        this.selection.set({
            ...(preserved ?? today), view: preserved?.view ?? 'month',
            courseId: preserved && (preserved.courseId === null || this.courses().some(course => course.id === preserved.courseId))
                ? preserved.courseId : this.scope.courseId,
        });
        this.initialized.set(true);
        void this.loadMonth(this.refreshOnEnter && this.isOnline());
        void this.loadPermission();
    }

    private async loadCourses(): Promise<void> {
        const choices = await calendarRead(() => this.data.courses(this.scope), this.life.signal).catch((): CalendarCourse[] => []);
        if (this.active()) {
            const [current] = this.courses();
            this.courses.set([current, ...choices.filter(course => course.id !== current.id)]);
        }
    }

    private async loadPermission(): Promise<void> {
        const revision = ++this.permissionRevision;
        const courseId = this.selection().courseId;
        this.canCreate.set(false);
        const allowed = await calendarRead(() => this.data.canCreate(this.scope, courseId), this.life.signal).catch(() => false);
        if (revision === this.permissionRevision && this.active() && !this.accessDenied) {
            this.canCreate.set(allowed);
        }
    }

    private denyAccess(): void {
        if (this.life.signal.aborted) {
            return;
        }
        this.accessDenied = true;
        ++this.monthRevision;
        ++this.permissionRevision;
        this.closeDetail();
        this.monthView.set(undefined);
        this.canCreate.set(false);
        this.loading.set(false);
        this.error.set(CHECK_SESSION);
    }

    private active(): boolean {
        return !this.life.signal.aborted && !this.journeySignal.aborted && this.data.isActive(this.scope);
    }

    private async leave(exit: CalendarExit): Promise<void> {
        this.actionPending.set(true);
        const result: CalendarModalResult = { modalId: this.modalId, exit };
        const dismissed = await ModalController.dismiss(result, undefined, this.modalId).catch(() => false);
        if (dismissed) {
            this.life.abort();
        } else if (this.active()) {
            this.actionPending.set(false);
            this.error.set('Não foi possível abrir esta opção do calendário. Tente novamente.');
        }
    }

}
