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

import { Component, OnInit, inject } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import {
    IFRN_MOODLE_PRESENCIAL_URL,
    MoodleSiteService,
    resolveMoodleSiteUrl,
} from '@/MoodleIFRN/services_mobile/moodle-site.service';
import { CoreNavigator } from '@services/navigator';
import { CoreAlerts } from '@services/overlays/alerts';
import { CoreLoadings } from '@services/overlays/loadings';
import { CorePlatform } from '@services/platform';
import { CorePromiseUtils } from '@static/promise-utils';

/**
 * Ponte mínima IFRN → Moodle Mobile nativo.
 *
 * Responsabilidade: identidade + courseId → handoff ao core.
 * Depois disso o Moodle App assume (seções, módulos, handlers nativos).
 *
 * Rota: /login/moodle-open-course (intermediária; sai com reset ao abrir).
 */
@Component({
    selector: 'page-moodle-open-course',
    templateUrl: './moodle-open-course.html',
    styleUrls: ['./moodle-open-course.scss'],
    imports: [
        CoreSharedModule,
    ],
})
export class MoodleOpenCoursePage implements OnInit {

    private readonly moodleSite = inject(MoodleSiteService);

    readonly defaultSiteUrl = IFRN_MOODLE_PRESENCIAL_URL;

    loading = false;
    statusMessage = '';
    formError = '';
    courseId = 0;
    courseName = '';
    /** Site Moodle realmente usado no CoreSites (nunca mock localhost). */
    moodleSiteUrl = IFRN_MOODLE_PRESENCIAL_URL;

    /** Evita segundo ngOnInit disparar OAuth na mesma instância. */
    private initStarted = false;

    async ngOnInit(): Promise<void> {
        await CorePlatform.ready();

        this.moodleSite.ensureLoginObserver();

        this.courseId = Number(CoreNavigator.getRouteNumberParam('courseId') || 0);
        this.courseName = CoreNavigator.getRouteParam('courseName') || '';

        const pending = this.moodleSite.getPendingOpenCourse();

        if (!this.courseId && pending?.courseId) {
            this.courseId = pending.courseId;
            this.courseName = pending.courseName || this.courseName;
        }

        this.moodleSiteUrl = resolveMoodleSiteUrl(pending?.siteUrl);

        const hasUrlSession = this.moodleSite.hasPresencialSession(this.moodleSiteUrl);
        const hasMatchingSession = this.moodleSite.hasMatchingPresencialSession(this.moodleSiteUrl);
        const identityOnly = CoreNavigator.getRouteBooleanParam('identityOnly');

        // eslint-disable-next-line no-console
        console.log('[IFRN-SITE] MoodleOpenCoursePage.init', {
            courseId: this.courseId,
            pendingSiteUrl: pending?.siteUrl || null,
            resolvedSiteUrl: this.moodleSiteUrl,
            hasPresencialSession: hasUrlSession,
            hasMatchingPresencialSession: hasMatchingSession,
            identityOnly,
            identityMismatchPending: this.moodleSite.identityMismatchPending,
            initStarted: this.initStarted,
        });
        // eslint-disable-next-line no-console
        console.log('[IFRN-COURSE] courseId recebido do Painel =', this.courseId || null);

        if (this.moodleSite.lastError) {
            this.formError = this.moodleSite.lastError;
        }

        if (!this.courseId) {
            this.formError = this.formError || 'Nenhum curso Moodle informado pelo Painel.';

            return;
        }

        // Retorno pós-OAuth com erro / mismatch: NÃO auto-iniciar outro OAuth.
        if (
            identityOnly
            || this.moodleSite.identityMismatchPending
            || this.initStarted
        ) {
            // eslint-disable-next-line no-console
            console.log('[IFRN-IDENTITY] auto-OAuth bloqueado (retorno / reentrância)');

            return;
        }

        this.initStarted = true;

        const startOAuth = CoreNavigator.getRouteBooleanParam('startOAuth')
            || this.moodleSite.shouldResumeOAuthAfterSiteSwitch();

        if (startOAuth) {
            await this.connectAndOpen({ resumeAfterSwitch: true });

            return;
        }

        await this.connectAndOpen();
    }

    goBack(): void {
        if (this.loading) {
            return;
        }

        const base = document.querySelector('base')?.getAttribute('href') || '/';
        const root = base.endsWith('/') ? base : `${base}/`;
        window.location.assign(`${root}mobilemoodle/index.html#/painel`);
    }

    async connectAndOpen(options: { resumeAfterSwitch?: boolean } = {}): Promise<void> {
        if (this.loading || !this.courseId) {
            return;
        }

        this.formError = '';
        this.moodleSite.lastError = '';
        this.moodleSite.identityMismatchPending = false;
        this.loading = true;

        const modal = await CoreLoadings.show('Abrindo curso Moodle…');

        try {
            if (options.resumeAfterSwitch) {
                this.statusMessage = 'Abrindo autenticação Moodle (SUAP)…';
                this.moodleSite.setPendingOpenCourse({
                    courseId: this.courseId,
                    courseName: this.courseName,
                    siteUrl: this.moodleSiteUrl,
                });

                const result = await this.moodleSite.startSuapOAuthLogin({
                    resumeAfterSwitch: true,
                });

                this.statusMessage = this.statusForOAuthResult(result);

                return;
            }

            this.statusMessage = 'Preparando sessão Moodle…';

            // Fecha o loading da ponte ANTES do handoff nativo (evita overlay
            // cobrindo seções/módulos se a página ainda estiver no stack).
            await modal.dismiss();

            const result = await this.moodleSite.ensureSessionAndOpenCourse(
                this.courseId,
                this.moodleSiteUrl,
                this.courseName,
            );

            if (result === 'opened') {
                this.statusMessage = 'Curso aberto no Moodle Mobile.';

                return;
            }

            this.statusMessage = this.statusForOAuthResult(
                result === 'browser-opened' ? 'opened' : result,
            );
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[IFRN-SITE] connectAndOpen erro', {
                message: error instanceof Error ? error.message : String(error),
                siteUrl: this.moodleSiteUrl,
                courseId: this.courseId,
            });

            this.statusMessage = '';
            this.formError = error instanceof Error
                ? error.message
                : 'Não foi possível abrir o curso Moodle.';
            void CoreAlerts.showError(error, {
                default: 'Não foi possível abrir o curso Moodle.',
            });
        } finally {
            await CorePromiseUtils.ignoreErrors(Promise.resolve(modal.dismiss()));
            this.loading = false;

            if (this.moodleSite.lastError && !this.formError) {
                this.formError = this.moodleSite.lastError;
            }
        }
    }

    private statusForOAuthResult(
        result: 'switched' | 'opened' | 'already-active',
    ): string {
        if (result === 'switched') {
            return 'Trocando conta Moodle…';
        }

        if (result === 'already-active') {
            return 'Autenticação Moodle já em andamento no navegador.';
        }

        return 'Complete o login SUAP no navegador. O app reabre e entrega o curso ao Moodle Mobile.';
    }

}
