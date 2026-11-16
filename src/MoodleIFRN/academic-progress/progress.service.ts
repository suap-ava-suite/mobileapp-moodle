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
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { CoreSites, CoreSitesReadingStrategy } from '@services/sites';
import { CoreCourse } from '@features/course/services/course';
import { CoreCourses, CoreEnrolledCourseData } from '@features/courses/services/courses';
import { CoreCourseCompletion } from '@features/course/services/course-completion';
import { CORE_COURSE_AUTO_SYNCED, CORE_COURSE_PROGRESS_UPDATED_EVENT } from '@features/course/constants';
import { CoreEvents } from '@static/events';
import { MoodleSiteService } from '../services_mobile/moodle-site.service';
import { AcademicProgressStore } from './progress-store';
import { isProgressRoute, unavailableProgress, validPercent, validateActivities,
    type ProgressContext, type ProgressPayload, type ProgressSnapshot } from './progress-model';

interface ProgressWatch {
    courseId: number;
    siteUrl: string;
    details: boolean;
    emit: (snapshot: ProgressSnapshot | null) => void;
    revision: number;
    loading: boolean;
    refreshAfterPending: boolean;
    boundOwner: string;
}

/** Adaptador de leitura. Não ativa sites, não inicia SSO, não altera conclusão nem credenciais. */
@Injectable({ providedIn: 'root' })
export class IfrnAcademicProgressService {

    private readonly store = new AcademicProgressStore();
    private readonly watches = new Set<ProgressWatch>();
    private readonly cleanups: (() => void)[] = [];
    private readonly courseRequests = new Map<string, Promise<CoreEnrolledCourseData[]>>();
    private owner = '';
    private blockedSite = '';
    private scheduled = false;
    private invalidationRequested = false;
    private readonly moodle = inject(MoodleSiteService);
    private readonly router = inject(Router);

    watch(
        courseId: number,
        siteUrl: string,
        details: boolean,
        emit: ProgressWatch['emit'],
    ): () => void {
        const watch: ProgressWatch = { courseId, siteUrl, details, emit, revision: 0,
            loading: false, refreshAfterPending: false, boundOwner: this.readOwner() };
        emit(unavailableProgress());
        this.watches.add(watch);
        if (this.watches.size === 1) { this.startListeners(); }
        this.scheduleRefresh();

        return () => {
            ++watch.revision;
            this.watches.delete(watch);
            if (!this.watches.size) { this.stop(); }
        };
    }

    refresh(): void { this.scheduleRefresh(true); }

    private readOwner(): string {
        try {
            const read = (key: string): string =>
                (sessionStorage.getItem(key) || localStorage.getItem(key) || '').trim().toLowerCase();
            const account = read('ifrn_username');

            return account && read('ifrn_painel_owner') === account ? account : '';
        } catch {
            return '';
        }
    }

    private context(watch: ProgressWatch): ProgressContext | undefined {
        const site = CoreSites.getCurrentSite();
        const owner = this.readOwner();
        if (!site || !owner || owner !== watch.boundOwner || site.isLoggedOut() || site.getId() === this.blockedSite
            || !Number.isSafeInteger(watch.courseId) || watch.courseId <= 0
            || !Number.isSafeInteger(site.getUserId()) || site.getUserId() <= 0) { return; }
        const url = site.getURL().replace(/\/$/, '');
        if (watch.siteUrl.replace(/\/$/, '') !== url || !this.moodle.hasMatchingPresencialSession(url)) { return; }

        return { owner, siteId: site.getId(), siteUrl: url, userId: site.getUserId(), courseId: watch.courseId };
    }

    private sameContext(watch: ProgressWatch, context: ProgressContext): boolean {
        const current = this.context(watch);

        return !!current && current.owner === context.owner && current.siteId === context.siteId
            && current.userId === context.userId && current.siteUrl === context.siteUrl;
    }

    private scheduleRefresh(invalidate = false): void {
        this.invalidationRequested ||= invalidate;
        if (this.scheduled) { return; }
        this.scheduled = true;
        void Promise.resolve().then(() => {
            this.scheduled = false;
            const invalidateRunning = this.invalidationRequested;
            this.invalidationRequested = false;
            const owner = this.readOwner();
            if (owner !== this.owner) {
                this.store.clear();
                this.courseRequests.clear();
                this.owner = owner;
                for (const watch of this.watches) { watch.emit(unavailableProgress()); }
            }
            for (const watch of this.watches) {
                const active = isProgressRoute(this.router.url, watch.details ? watch.courseId : undefined);
                if (!active) { continue; }
                if (watch.loading) { watch.refreshAfterPending ||= invalidateRunning; continue; }
                void this.refreshWatch(watch);
            }

            return;
        });
    }

    private async refreshWatch(watch: ProgressWatch): Promise<void> {
        const context = this.context(watch);
        if (!context) {
            // O agregado pertence ao dashboard validado; nunca aciona autenticação para preencher cartões.
            const owner = this.readOwner();
            watch.emit(owner && owner === watch.boundOwner && !watch.details
                && (!this.blockedSite || CoreSites.getCurrentSiteId() !== this.blockedSite) ? null : unavailableProgress());

            return;
        }
        const revision = ++watch.revision;
        watch.loading = true;
        const cached = this.store.peek(context);
        watch.emit(cached ? { ...cached, status: 'stale' } : unavailableProgress('loading'));
        const snapshot = await this.store.load(
            context,
            () => this.read(context, watch.details),
            () => this.sameContext(watch, context),
        );
        watch.loading = false;
        if (!this.watches.has(watch) || revision !== watch.revision) { return; }
        watch.emit(this.sameContext(watch, context) ? snapshot : unavailableProgress());
        // Um evento ocorrido durante a consulta requer uma única nova leitura, sem polling.
        if (watch.refreshAfterPending || (watch.details && snapshot.status === 'ready' && snapshot.total === null)) {
            watch.refreshAfterPending = false;
            if (isProgressRoute(this.router.url, watch.details ? watch.courseId : undefined)) {
                void this.refreshWatch(watch);
            }
        }
    }

    private async read(context: ProgressContext, details: boolean): Promise<ProgressPayload> {
        const [courseResult, activityResult] = await Promise.allSettled([
            this.userCourses(context),
            details ? CoreCourse.getActivitiesCompletionStatus(
                context.courseId,
                context.siteId,
                context.userId,
                false,
                true,
                false,
            ).then(validateActivities) : undefined,
        ]);
        if (courseResult.status === 'rejected') { throw courseResult.reason; }
        const course = courseResult.value.find(item => item.id === context.courseId);
        if (!course) { throw Object.assign(new Error('Course unavailable'), { errorcode: 'nopermissions' }); }
        const site = await CoreSites.getSite(context.siteId);
        const enabled = course.enablecompletion !== false && course.completionusertracked !== false
            && CoreCourseCompletion.isCompletionEnabledInSite(site);
        if (enabled && activityResult.status === 'rejected') { throw activityResult.reason; }

        return { enabled, percent: validPercent(course.progress),
            activities: activityResult.status === 'fulfilled' ? activityResult.value : undefined };
    }

    private userCourses(context: ProgressContext): Promise<CoreEnrolledCourseData[]> {
        const key = JSON.stringify([context.owner, context.siteId, context.userId]);
        let pending = this.courseRequests.get(key);
        if (!pending) {
            pending = CoreCourses.getUserCourses(false, context.siteId, CoreSitesReadingStrategy.ONLY_NETWORK);
            this.courseRequests.set(key, pending);
            const request = pending;
            void pending.finally(() => {
                if (this.courseRequests.get(key) === request) { this.courseRequests.delete(key); }
            }).catch(() => undefined); // A falha é tratada pelo store; este finally apenas libera a referência.
        }

        return pending;
    }

    private startListeners(): void {
        const subscription = this.router.events.subscribe(event => {
            if (event instanceof NavigationEnd) { this.scheduleRefresh(true); }
        });
        this.cleanups.push(() => subscription.unsubscribe());
        const observe = (event: string, callback: (data: Record<string, unknown>) => void): void => {
            const observer = CoreEvents.on<Record<string, unknown>>(event, callback);
            this.cleanups.push(() => observer.off());
        };
        for (const event of [CoreEvents.MANUAL_COMPLETION_CHANGED, CoreEvents.COMPLETION_MODULE_VIEWED,
            CORE_COURSE_AUTO_SYNCED, CORE_COURSE_PROGRESS_UPDATED_EVENT]) {
            observe(event, data => {
                if (data['siteId'] && data['siteId'] !== CoreSites.getCurrentSiteId()) { return; }
                this.scheduleRefresh(true);
            });
        }
        for (const event of [CoreEvents.LOGIN, CoreEvents.SITE_UPDATED, CoreEvents.LOGOUT]) {
            observe(event, () => {
                this.store.clear();
                this.courseRequests.clear();
                this.blockedSite = '';
                for (const watch of this.watches) { watch.emit(unavailableProgress()); }
                this.scheduleRefresh();
            });
        }
        observe(CoreEvents.SESSION_EXPIRED, data => {
            this.blockedSite = typeof data['siteId'] === 'string' ? data['siteId'] : CoreSites.getCurrentSiteId();
            this.store.clear();
            for (const watch of this.watches) { watch.emit(unavailableProgress()); }
        });
        const refresh = (): void => this.scheduleRefresh(true);
        const visible = (): void => { if (document.visibilityState === 'visible') { refresh(); } };
        document.addEventListener('resume', refresh);
        document.addEventListener('visibilitychange', visible);
        window.addEventListener('storage', refresh);
        this.cleanups.push(
            () => document.removeEventListener('resume', refresh),
            () => document.removeEventListener('visibilitychange', visible),
            () => window.removeEventListener('storage', refresh),
        );
    }

    private stop(): void {
        for (const cleanup of this.cleanups.splice(0)) { cleanup(); }
        this.store.clear();
        this.courseRequests.clear();
        this.owner = '';
    }

}
