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

import { Component, OnDestroy, inject } from '@angular/core';
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
type OpenCoursePhase = 'loading' | 'need-connect' | 'waiting-browser' | 'error';

/**
 * Ponte mínima IFRN → Moodle Mobile nativo.
 *
 * Com sessão Moodle válida e correspondente: abre o curso em silêncio.
 * Sem sessão reutilizável: autentica pelo fluxo SSO oficial e retoma o curso nativo pelo callback.
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
export class MoodleOpenCoursePage implements OnDestroy {

    private readonly moodleSite = inject(MoodleSiteService);

    readonly defaultSiteUrl = IFRN_MOODLE_PRESENCIAL_URL;
    readonly ifrnSymbolSrc = 'mobilemoodle/static/theme/ifrn/img/ifrn-symbol.svg';

    loading = false;
    formError = '';
    accountSwitchStarted = false;
    courseId = 0;
    courseName = '';
    /** Site Moodle realmente usado no CoreSites (nunca mock localhost). */
    moodleSiteUrl = IFRN_MOODLE_PRESENCIAL_URL;

    /** loading = abertura; waiting-browser = OAuth SSO; error = recuperação. */
    phase: OpenCoursePhase = 'loading';

    /** Evita segundo ngOnInit disparar o fluxo na mesma instância. */
    private initStarted = false;
    private entryVersion = 0;
    private browserWaitTimer?: ReturnType<typeof setTimeout>;

    /**
     * Algumas navegações vindas do iframe do Painel montam a rota sem repassar
     * o lifecycle Ionic. Inicia a mesma entrada como fallback após o primeiro
     * ciclo Angular; se o lifecycle normal rodar antes, entryVersion evita
     * executar o fluxo duas vezes.
     */
    ngOnInit(): void {
        queueMicrotask(() => {
            if (this.entryVersion === 0) {
                void this.ionViewWillEnter();
            }
        });
    }

    private clearBrowserWait(): void {
        clearTimeout(this.browserWaitTimer);
        this.browserWaitTimer = undefined;
    }

    ionViewWillLeave(): void {
        // Invalida também awaits ainda pendentes: sair da ponte não pode
        // disparar OAuth ou recolocar a UI de erro depois em outra tela.
        this.entryVersion++;
        this.clearBrowserWait();
    }

    ngOnDestroy(): void {
        this.entryVersion++;
        this.clearBrowserWait();
    }

    get accountIssue(): MoodleSiteService['lastCourseAccessIssue'] {
        return this.moodleSite.lastCourseAccessIssue;
    }

    /** Abre a saída SUAP dentro do InAppBrowser compartilhado com o Painel. */
    changeMoodleAccount(): void {
        if (this.loading || !this.courseId) {
            return;
        }

        this.moodleSite.hideNativeCourseHandoff();
        this.accountSwitchStarted = true;
        this.moodleSite.openCourseAccountLogout(this.moodleSiteUrl);
    }

    /** Após confirmar a saída SUAP no IAB, reinicia o OAuth oficial do curso. */
    async continueAccountSwitch(): Promise<void> {
        if (this.loading || !this.accountSwitchStarted || !this.courseId) {
            return;
        }
        this.accountSwitchStarted = false;
        await this.startOAuthFlow();
    }

    async returnToIfrnLogin(): Promise<void> {
        if (this.loading) {
            return;
        }

        this.loading = true;
        try {
            await this.moodleSite.returnToIfrnLogin();
        } finally {
            this.loading = false;
        }
    }

    async ionViewWillEnter(): Promise<void> {
        this.clearBrowserWait();
        // O Ionic mantém a ponte em cache: cada toque precisa reler curso e ambiente.
        const entry = ++this.entryVersion;
        this.initStarted = false;
        this.loading = false;
        this.formError = '';
        this.accountSwitchStarted = false;
        await CorePlatform.ready();
        if (entry !== this.entryVersion) {
            return;
        }

        this.moodleSite.ensureLoginObserver();
        // Cobre /main e o bootstrap Ionic antes de qualquer await de sessão/OAuth.
        this.moodleSite.showNativeCourseHandoff();
        this.phase = 'loading';

        this.courseId = Number(CoreNavigator.getRouteNumberParam('courseId') || 0);
        this.courseName = CoreNavigator.getRouteParam('courseName') || '';

        const pending = this.moodleSite.getPendingOpenCourse();

        if (!this.courseId && pending?.courseId) {
            this.courseId = pending.courseId;
            this.courseName = pending.courseName || this.courseName;
        }

        // A rota do toque atual tem precedência; um pendente de outro curso não pode trocar o ambiente.
        const routeSiteUrl = CoreNavigator.getRouteParam<string>('siteUrl');
        this.moodleSiteUrl = resolveMoodleSiteUrl(
            routeSiteUrl || (pending?.courseId === this.courseId ? pending.siteUrl : undefined),
        );

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
                    if (entry !== this.entryVersion) {
                        return;
                    }
                    this.initStarted = true;
                    if (this.moodleSite.lastError) {
                        this.revealBridgeError(this.moodleSite.lastError);
                    } else {
                        // openCourseById já remove o overlay; reforça se a rota mudou.
                        this.moodleSite.hideNativeCourseHandoff();
                    }

                    return;
                }
            } catch (error) {
                if (entry !== this.entryVersion) {
                    return;
                }
                this.revealBridgeError(error instanceof Error ? error.message : String(error));

                return;
            } finally {
                if (entry === this.entryVersion) {
                    this.loading = false;
                }
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
            this.revealBridgeError(
                this.formError
                || this.moodleSite.lastError
                || 'Não foi possível abrir o curso. Tente novamente.',
            );

            return;
        }

        this.initStarted = true;
        this.phase = 'loading';

        // A flag persistida isolada pode pertencer a uma tentativa abandonada.
        // Somente o redirect explícito da troca de conta retoma a conexão.
        const startOAuth = CoreNavigator.getRouteBooleanParam('startOAuth');

        if (startOAuth && this.moodleSite.consumeOAuthResume(this.courseId, this.moodleSiteUrl)) {
            await this.startOAuthFlow({ resumeAfterSwitch: true });

            return;
        }

        // Course tap already expresses intent. If its Moodle session is missing,
        // authenticate inside the Panel's SUAP-capable IAB and resume this course.
        await this.tryOpenOrPromptConnect(true);
    }

    cancelOpening(): void {
        this.clearBrowserWait();
        this.entryVersion++;
        this.loading = false;
        this.moodleSite.dismissCourseRecovery();
        this.moodleSite.hideNativeCourseHandoff();
        void CoreNavigator.navigate('/login/painel');
    }

    goBack(): void {
        if (this.loading) {
            return;
        }

        this.moodleSite.dismissCourseRecovery();
        this.moodleSite.hideNativeCourseHandoff();
        void CoreNavigator.navigate('/login/painel');
    }

    /**
     * Verifica a sessão antes de oferecer ou iniciar uma conexão solicitada pelo usuário.
     */
    async tryOpenOrPromptConnect(connectIfNeeded = false): Promise<void> {
        if (this.loading || !this.courseId) {
            return;
        }
        const entry = this.entryVersion;

        this.formError = '';
        this.phase = 'loading';
        this.moodleSite.lastError = '';
        this.moodleSite.setIdentityMismatchPending(false);
        this.loading = true;
        this.moodleSite.showNativeCourseHandoff();

        try {
            const result = await this.moodleSite.ensureSessionAndOpenCourse(
                this.courseId,
                this.moodleSiteUrl,
                this.courseName,
            );
            if (entry !== this.entryVersion) {
                return;
            }

            if (result === 'opened') {
                return;
            }

            this.moodleSite.hideNativeCourseHandoff();
            this.loading = false;
            if (connectIfNeeded) {
                await this.startOAuthFlow();
            } else {
                this.phase = 'need-connect';
            }
        } catch (error) {
            if (entry !== this.entryVersion) {
                return;
            }
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
            if (entry !== this.entryVersion) {
                return;
            }
            this.loading = false;

            if (this.moodleSite.lastError && !this.formError) {
                this.revealBridgeError(this.moodleSite.lastError);
            }
        }
    }

    /** Revalida a sessão e reinicia o OAuth oficial no IAB se ainda for necessário. */
    async retryConnect(): Promise<void> {
        await this.tryOpenOrPromptConnect(true);
    }

    /** Revalida a sessão para não abrir OAuth se outra tentativa já a recuperou. */
    async connectMoodle(): Promise<void> {
        await this.tryOpenOrPromptConnect(true);
    }

    private async startOAuthFlow(options: { resumeAfterSwitch?: boolean } = {}): Promise<void> {
        if (this.loading || !this.courseId) {
            return;
        }
        const entry = this.entryVersion;

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

            this.phase = 'waiting-browser';

            const oauthResult = await this.moodleSite.startSuapOAuthLogin({
                resumeAfterSwitch: options.resumeAfterSwitch === true,
            });
            if (entry !== this.entryVersion) {
                return;
            }

            if (oauthResult === 'switched') {
                // switch-account: a navegação reinicia esta página com startOAuth.
                this.phase = 'loading';
                this.moodleSite.showNativeCourseHandoff();

                return;
            }

            if (CoreNavigator.getCurrentPath().split(/[?#]/)[0] !== '/login/moodle-open-course') {
                return;
            }

            if (this.isBridgeInError()) {
                return;
            }

            // O browser existe somente para o SSO. O callback oficial retorna
            // ao app e a rota abre o curso nativo selecionado.
            this.phase = 'waiting-browser';
            this.loading = false;
            this.clearBrowserWait();
            this.browserWaitTimer = setTimeout(() => {
                if (entry !== this.entryVersion || this.phase !== 'waiting-browser') {
                    return;
                }
                this.moodleSite.releaseOAuthBrowserWait();
                this.revealBridgeError(this.moodleSite.lastError || 'O SUAP não concluiu a autenticação do curso. '
                    + 'Tente novamente e conclua o login; o app retomará o curso selecionado.');
            }, 180000);
        } catch (error) {
            if (entry !== this.entryVersion) {
                return;
            }
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
            if (entry !== this.entryVersion) {
                return;
            }
            this.loading = false;

            if (this.moodleSite.lastError && !this.formError) {
                this.revealBridgeError(this.moodleSite.lastError);
            }
        }
    }

    private revealBridgeError(message: string): void {
        this.clearBrowserWait();
        this.formError = message;
        this.phase = 'error';
        this.moodleSite.hideNativeCourseHandoff();
    }

    private isBridgeInError(): boolean {
        return this.phase === 'error';
    }

}
