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
import { CorePlatform } from '@services/platform';

/**
 * Ponte mínima IFRN → Moodle Mobile nativo.
 *
 * No fluxo feliz a UI fica silenciosa (só spinner). A tela de diagnóstico
 * (“Abrir curso” / site / courseid / “Complete o login…”) só aparece em erro.
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
    formError = '';
    courseId = 0;
    courseName = '';
    /** Site Moodle realmente usado no CoreSites (nunca mock localhost). */
    moodleSiteUrl = IFRN_MOODLE_PRESENCIAL_URL;

    /**
     * true só quando há erro / mismatch e o usuário precisa recuperar.
     * false = tela silenciosa enquanto OAuth / abertura do curso rodam.
     */
    showBridgeUi = false;

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
            this.revealBridgeError(this.moodleSite.lastError);
        }

        if (!this.courseId) {
            this.revealBridgeError(
                this.formError || 'Nenhum curso Moodle informado pelo Painel.',
            );

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
            this.showBridgeUi = true;

            if (!this.formError && this.moodleSite.lastError) {
                this.formError = this.moodleSite.lastError;
            }

            return;
        }

        this.initStarted = true;
        this.showBridgeUi = false;

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
        this.showBridgeUi = false;
        this.moodleSite.lastError = '';
        this.moodleSite.identityMismatchPending = false;
        this.loading = true;

        // Sem overlay Ionic por cima — a própria página já é o loading silencioso.
        // (Evita a tela “Abrir curso” + modal “Loading” das capturas.)

        try {
            if (options.resumeAfterSwitch) {
                this.moodleSite.setPendingOpenCourse({
                    courseId: this.courseId,
                    courseName: this.courseName,
                    siteUrl: this.moodleSiteUrl,
                });

                await this.moodleSite.startSuapOAuthLogin({
                    resumeAfterSwitch: true,
                });

                // Browser aberto: mantém UI silenciosa até o deep link voltar.
                return;
            }

            const result = await this.moodleSite.ensureSessionAndOpenCourse(
                this.courseId,
                this.moodleSiteUrl,
                this.courseName,
            );

            if (result === 'opened') {
                return;
            }

            // OAuth no navegador / switch-account: continua silencioso.
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[IFRN-SITE] connectAndOpen erro', {
                message: error instanceof Error ? error.message : String(error),
                siteUrl: this.moodleSiteUrl,
                courseId: this.courseId,
            });

            this.revealBridgeError(
                error instanceof Error
                    ? error.message
                    : 'Não foi possível abrir o curso Moodle.',
            );
            void CoreAlerts.showError(error, {
                default: 'Não foi possível abrir o curso Moodle.',
            });
        } finally {
            this.loading = false;

            if (this.moodleSite.lastError && !this.formError) {
                this.revealBridgeError(this.moodleSite.lastError);
            }
        }
    }

    private revealBridgeError(message: string): void {
        this.formError = message;
        this.showBridgeUi = true;
    }

}
