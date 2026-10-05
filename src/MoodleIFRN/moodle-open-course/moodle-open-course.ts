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

/** Estados da ponte Painel → Moodle (bate com o template). */
type OpenCoursePhase = 'loading' | 'waiting-browser' | 'error';

/**
 * Ponte mínima IFRN → Moodle Mobile nativo.
 *
 * Com sessão Moodle válida e correspondente: abre o curso em silêncio.
 * Sem sessão reutilizável: inicia o OAuth/SSO oficial automaticamente, sem tela intermediária.
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
    readonly ifrnSymbolSrc = 'mobilemoodle/static/theme/ifrn/img/ifrn-symbol.svg';

    loading = false;
    formError = '';
    courseId = 0;
    courseName = '';
    /** Site Moodle realmente usado no CoreSites (nunca mock localhost). */
    moodleSiteUrl = IFRN_MOODLE_PRESENCIAL_URL;

    /**
     * loading = spinner “Abrindo curso…”
     * waiting-browser = OAuth no navegador externo
     * error = UI de recuperação
     */
    phase: OpenCoursePhase = 'loading';

    /** Evita segundo ngOnInit disparar o fluxo na mesma instância. */
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
        console.log('[IFRN-SITE] MoodleOpenCoursePage.init', JSON.stringify({
            courseId: this.courseId,
            pendingSiteUrl: pending?.siteUrl || null,
            resolvedSiteUrl: this.moodleSiteUrl,
            hasPresencialSession: hasUrlSession,
            hasMatchingPresencialSession: hasMatchingSession,
            identityOnly,
            identityMismatchPending: this.moodleSite.isIdentityMismatchPending(),
            initStarted: this.initStarted,
        }));
        // eslint-disable-next-line no-console
        console.log('[IFRN-COURSE] courseId recebido do Painel =', this.courseId || null);

        if (this.moodleSite.lastError) {
            this.formError = this.moodleSite.lastError;
        }

        if (!this.courseId) {
            this.revealBridgeError(
                this.formError || 'Nenhum curso Moodle informado pelo Painel.',
            );

            return;
        }

        // O redirectPath do OAuth chega aqui depois do login nativo. Esta ponte
        // é a única dona da retomada; o listener LOGIN não abre outro curso.
        if (!identityOnly) {
            this.loading = true;
            try {
                if (await this.moodleSite.resumePendingOAuthCourse()) {
                    this.initStarted = true;
                    if (this.moodleSite.lastError) {
                        this.revealBridgeError(this.moodleSite.lastError);
                    }

                    return;
                }
            } catch (error) {
                this.revealBridgeError(error instanceof Error ? error.message : String(error));

                return;
            } finally {
                this.loading = false;
            }
        }

        // Retorno pós-OAuth com erro / mismatch: NÃO auto-iniciar outro OAuth.
        if (
            identityOnly
            || this.moodleSite.isIdentityMismatchPending()
            || this.initStarted
        ) {
            // eslint-disable-next-line no-console
            console.log('[IFRN-IDENTITY] auto-OAuth bloqueado (retorno / reentrância)');
            this.phase = 'error';

            if (!this.formError && this.moodleSite.lastError) {
                this.formError = this.moodleSite.lastError;
            }

            return;
        }

        this.initStarted = true;
        this.phase = 'loading';

        const startOAuth = CoreNavigator.getRouteBooleanParam('startOAuth')
            || this.moodleSite.shouldResumeOAuthAfterSiteSwitch();

        if (startOAuth) {
            await this.startOAuthFlow({ resumeAfterSwitch: true });

            return;
        }

        await this.tryOpenOrPromptConnect();
    }

    goBack(): void {
        if (this.loading) {
            return;
        }

        const base = document.querySelector('base')?.getAttribute('href') || '/';
        const root = base.endsWith('/') ? base : `${base}/`;
        window.location.assign(`${root}mobilemoodle/index.html#/painel`);
    }

    /**
     * Verifica sessão Moodle: abre o curso se válida; senão inicia o OAuth oficial automaticamente.
     */
    async tryOpenOrPromptConnect(): Promise<void> {
        if (this.loading || !this.courseId) {
            return;
        }

        this.formError = '';
        this.phase = 'loading';
        this.moodleSite.lastError = '';
        this.moodleSite.setIdentityMismatchPending(false);
        this.loading = true;

        try {
            const result = await this.moodleSite.ensureSessionAndOpenCourse(
                this.courseId,
                this.moodleSiteUrl,
                this.courseName,
            );

            if (result === 'opened') {
                return;
            }

            // Sem sessão reutilizável: não exibe uma segunda tela/botão.
            // Libera o lock desta verificação e inicia o OAuth oficial imediatamente.
            // eslint-disable-next-line no-console
            console.log('[IFRN-COURSE] sessão Moodle ausente — iniciando OAuth automaticamente');
            this.loading = false;
            await this.startOAuthFlow();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[IFRN-SITE] tryOpenOrPromptConnect erro', JSON.stringify({
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                siteUrl: this.moodleSiteUrl,
                courseId: this.courseId,
            }));

            this.revealBridgeError(
                error instanceof Error
                    ? error.message
                    : 'Não foi possível abrir o curso Moodle.',
            );
            this.moodleSite.lastError = this.formError;

            // Se /main já abriu e o deep-link falhou, mostrar o erro e a opção
            // de tentar novamente na ponte. Não redirecionar ao Painel nem
            // tratar uma falha como abertura bem-sucedida.
            if (CoreNavigator.getCurrentPath().split(/[?#]/)[0] !== '/login/moodle-open-course') {
                await CoreNavigator.navigate('/login/moodle-open-course', {
                    animated: false,
                    params: {
                        courseId: this.courseId,
                        courseName: this.courseName,
                        identityOnly: true,
                    },
                });
            }
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

    /**
     * “Tentar novamente” após erro: revalida a sessão e, se necessário, reinicia o OAuth oficial.
     */
    async retryConnect(): Promise<void> {
        await this.tryOpenOrPromptConnect();
    }

    private async startOAuthFlow(options: { resumeAfterSwitch?: boolean } = {}): Promise<void> {
        if (this.loading || !this.courseId) {
            return;
        }

        this.formError = '';
        this.phase = 'loading';
        this.moodleSite.lastError = '';
        this.moodleSite.setIdentityMismatchPending(false);
        this.loading = true;

        try {
            this.moodleSite.setPendingOpenCourse({
                courseId: this.courseId,
                courseName: this.courseName,
                siteUrl: this.moodleSiteUrl,
            });

            const oauthResult = await this.moodleSite.startSuapOAuthLogin({
                resumeAfterSwitch: options.resumeAfterSwitch === true,
            });

            if (oauthResult === 'switched') {
                // switch-account: a navegação reinicia esta página com startOAuth.
                this.phase = 'loading';

                return;
            }

            // Browser externo aberto (ou fluxo já ativo): orienta o usuário.
            this.phase = 'waiting-browser';
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[IFRN-SITE] startOAuthFlow erro', JSON.stringify({
                message: error instanceof Error ? error.message : String(error),
                siteUrl: this.moodleSiteUrl,
                courseId: this.courseId,
            }));

            this.revealBridgeError(
                error instanceof Error
                    ? error.message
                    : 'Não foi possível iniciar a autenticação SUAP.',
            );
            void CoreAlerts.showError(error, {
                default: 'Não foi possível iniciar a autenticação SUAP.',
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
        this.phase = 'error';
    }

}
