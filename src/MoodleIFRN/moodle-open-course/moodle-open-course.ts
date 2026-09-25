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
} from '@/MoodleIFRN/services_mobile/moodle-site.service';
import { CoreNavigator } from '@services/navigator';
import { CoreAlerts } from '@services/overlays/alerts';
import { CoreLoadings } from '@services/overlays/loadings';
import { CorePlatform } from '@services/platform';

/**
 * Abre um courseid Moodle via CoreSites (OAuth SUAP do Moodle se necessário).
 * Entrada típica: clique em diário no painel mobilemoodle.
 * Rota: /login/moodle-open-course?courseId=123
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

    readonly siteUrl = IFRN_MOODLE_PRESENCIAL_URL;

    loading = false;
    statusMessage = '';
    formError = '';
    courseId = 0;
    courseName = '';
    moodleSiteUrl = '';

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

        this.moodleSiteUrl = pending?.siteUrl || this.siteUrl;

        // Diagnóstico temporário do fluxo Painel -> Moodle.
        // Não registra tokens nem credenciais.
        // eslint-disable-next-line no-console
        console.log('[IFRN-OPEN] courseId =', this.courseId);
        // eslint-disable-next-line no-console
        console.log('[IFRN-OPEN] courseName =', this.courseName);
        // eslint-disable-next-line no-console
        console.log('[IFRN-OPEN] siteUrl =', this.moodleSiteUrl);
        // eslint-disable-next-line no-console
        console.log('[IFRN-OPEN] pending =', pending);

        if (!this.courseId) {
            this.formError = 'Nenhum curso Moodle informado.';

            return;
        }

        // Retorno do switch-account / OAuth.
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

        // Volta ao painel HTML (mesma origem).
        const base = document.querySelector('base')?.getAttribute('href') || '/';
        const root = base.endsWith('/') ? base : `${base}/`;
        window.location.assign(`${root}mobilemoodle/index.html#/painel`);
    }

    async connectAndOpen(options: { resumeAfterSwitch?: boolean } = {}): Promise<void> {
        if (this.loading || !this.courseId) {
            return;
        }

        // eslint-disable-next-line no-console
        console.log('[IFRN-OPEN] connectAndOpen iniciado');
        // eslint-disable-next-line no-console
        console.log(
            '[IFRN-OPEN] hasSession =',
            this.moodleSite.hasPresencialSession(this.moodleSiteUrl),
        );

        this.formError = '';
        this.loading = true;
        this.statusMessage = this.moodleSite.hasPresencialSession(this.moodleSiteUrl)
            ? `Abrindo curso ${this.courseId}…`
            : 'Conectando ao Moodle via SUAP OAuth…';

        const modal = await CoreLoadings.show(
            this.moodleSite.hasPresencialSession(this.moodleSiteUrl)
                ? 'Abrindo curso…'
                : 'Autenticando no Moodle…',
        );

        try {
            if (options.resumeAfterSwitch || !this.moodleSite.hasPresencialSession(this.moodleSiteUrl)) {
                this.moodleSite.setPendingOpenCourse({
                    courseId: this.courseId,
                    courseName: this.courseName,
                    siteUrl: this.moodleSiteUrl,
                });

                const result = await this.moodleSite.startSuapOAuthLogin({
                    resumeAfterSwitch: options.resumeAfterSwitch,
                });

                this.statusMessage = result === 'switched'
                    ? 'Trocando conta Moodle…'
                    : 'Complete o login SUAP no navegador. O curso abrirá ao voltar.';

                return;
            }

            await this.moodleSite.openCourseById(this.courseId);
            this.moodleSite.clearPendingOpenCourse();
            this.statusMessage = `Curso ${this.courseId} aberto.`;
        } catch (error) {
            this.statusMessage = '';
            this.formError = error instanceof Error
                ? error.message
                : 'Não foi possível abrir o curso Moodle.';
            void CoreAlerts.showError(error, {
                default: 'Não foi possível abrir o curso Moodle.',
            });
        } finally {
            modal.dismiss();
            this.loading = false;
        }
    }

}
