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

import { Injectable } from '@angular/core';
import { CoreSiteIdentityProvider } from '@classes/sites/unauthenticated-site';
import { NO_SITE_ID } from '@features/login/constants';
import { CoreCourseHelper } from '@features/course/services/course-helper';
import { CoreCourses, CoreEnrolledCourseData } from '@features/courses/services/courses';
import { CoreLoginHelper } from '@features/login/services/login-helper';
import { CoreNavigator } from '@services/navigator';
import { CoreSites, CoreSiteCheckResponse } from '@services/sites';
import { CoreSitesFactory } from '@services/sites-factory';
import { CoreUrl } from '@static/url';
import { CoreEvents } from '@static/events';
import { CoreLogger } from '@static/logger';
import { CoreOpener } from '@static/opener';
import { Translate } from '@singletons';

/** Site Moodle usado no PoC IFRN. */
export const IFRN_MOODLE_PRESENCIAL_URL = 'https://presencial.ava.ifrn.edu.br';

/** courseid de exemplo (Metodologia) — usado se o usuário estiver inscrito. */
export const IFRN_MOODLE_POC_COURSE_ID = 2836;

const POC_PENDING_KEY = 'ifrn_moodle_poc_oauth_pending';
const POC_RESUME_OAUTH_KEY = 'ifrn_moodle_poc_resume_oauth';
const PENDING_OPEN_COURSE_KEY = 'ifrn_moodle_pending_open_course';
const LOG_PREFIX = '[IFRN Moodle PoC]';

export interface MoodlePendingOpenCourse {
    courseId: number;
    siteUrl?: string;
    courseName?: string;
}

export interface MoodlePocCourseSummary {
    id: number;
    name: string;
}

export interface MoodlePocSessionSummary {
    userFullName: string;
    username: string;
    siteUrl: string;
    siteName: string;
    courseCount: number;
    courses: MoodlePocCourseSummary[];
    openedCourseId?: number;
}

/**
 * PoC: autentica no AVA-Presencial via OAuth SUAP do próprio Moodle
 * e reutiliza CoreSites / CoreCourses / CoreCourseHelper do núcleo.
 *
 * Não usa o JWT do SUAP do AuthService.
 */
@Injectable({
    providedIn: 'root',
})
export class MoodleSiteService {

    private readonly logger = CoreLogger.getInstance('MoodleSiteService');

    /** Último resultado do PoC (para a UI). */
    lastSummary: MoodlePocSessionSummary | null = null;

    /** Último erro amigável do PoC. */
    lastError = '';

    private loginObserverRegistered = false;

    /**
     * Garante o listener de LOGIN (retorno do OAuth).
     */
    ensureLoginObserver(): void {
        if (this.loginObserverRegistered) {
            return;
        }

        this.loginObserverRegistered = true;

        CoreEvents.on(CoreEvents.LOGIN, () => {
            if (sessionStorage.getItem(POC_PENDING_KEY) !== '1') {
                return;
            }

            sessionStorage.removeItem(POC_PENDING_KEY);

            // Deixa o núcleo concluir navigateToSiteHome e depois volta ao PoC
            // ou abre o curso pendente (fluxo do painel).
            window.setTimeout(() => {
                void this.afterOAuthLogin();
            }, 800);
        });
    }

    /**
     * Agenda abertura de um courseid Moodle após OAuth (ou imediatamente se já houver sessão).
     */
    setPendingOpenCourse(pending: MoodlePendingOpenCourse): void {
        sessionStorage.setItem(PENDING_OPEN_COURSE_KEY, JSON.stringify(pending));
    }

    getPendingOpenCourse(): MoodlePendingOpenCourse | null {
        const raw = sessionStorage.getItem(PENDING_OPEN_COURSE_KEY);

        if (!raw) {
            return null;
        }

        try {
            const parsed = JSON.parse(raw) as MoodlePendingOpenCourse;

            if (!parsed || typeof parsed.courseId !== 'number' || parsed.courseId <= 0) {
                return null;
            }

            return parsed;
        } catch {
            return null;
        }
    }

    clearPendingOpenCourse(): void {
        sessionStorage.removeItem(PENDING_OPEN_COURSE_KEY);
    }

    /**
     * Garante sessão Moodle e abre o courseid (fluxo “clicar no diário”).
     * Se não houver sessão, inicia OAuth SUAP do Moodle e abre ao retornar.
     */
    async ensureSessionAndOpenCourse(courseId: number, siteUrl?: string): Promise<'opened' | 'oauth'> {
        this.ensureLoginObserver();
        this.lastError = '';

        this.setPendingOpenCourse({ courseId, siteUrl });

        if (this.hasPresencialSession(siteUrl)) {
            await this.openCourseById(courseId);
            this.clearPendingOpenCourse();

            return 'opened';
        }

        await this.startSuapOAuthLogin();

        return 'oauth';
    }

    /**
     * Abre um courseid específico com CoreCourseHelper.getAndOpenCourse.
     */
    async openCourseById(courseId: number): Promise<number> {
        this.lastError = '';

        if (!CoreSites.isLoggedIn()) {
            throw new Error('Não há sessão Moodle ativa.');
        }

        if (!Number.isFinite(courseId) || courseId <= 0) {
            throw new Error('Identificador de curso Moodle inválido.');
        }

        this.logger.debug(`${LOG_PREFIX} Abrindo curso id=${courseId}`);

        await CoreCourseHelper.getAndOpenCourse(courseId);

        if (this.lastSummary) {
            this.lastSummary.openedCourseId = courseId;
        }

        return courseId;
    }

    /**
     * Há sessão Moodle ativa no site presencial?
     * (sessão restaurada pelo CoreSites — não implica OAuth do PoC).
     */
    hasPresencialSession(siteUrl = IFRN_MOODLE_PRESENCIAL_URL): boolean {
        const site = CoreSites.getCurrentSite();

        if (!site || !CoreSites.isLoggedIn() || site.isLoggedOut()) {
            return false;
        }

        return CoreUrl.sameDomainAndPath(site.getURL(), siteUrl);
    }

    /**
     * True quando o PoC pediu switch-account e deve retomar o OAuth ao voltar.
     */
    shouldResumeOAuthAfterSiteSwitch(): boolean {
        return sessionStorage.getItem(POC_RESUME_OAUTH_KEY) === '1';
    }

    /**
     * Abre o OAuth SUAP do AVA-Presencial (identity provider do Moodle).
     *
     * Não reutiliza silenciosamente CoreSites.getCurrentSite(): se já houver
     * sessão ativa, faz switch-account (mantém o site antigo armazenado) e
     * retoma o OAuth no PoC — mesmo padrão de CoreLoginHelper.goToAddSite /
     * choose-site addNewSite.
     *
     * Após o deep link, o núcleo chama CoreSites.newSite().
     */
    /**
     * @returns `switched` se pediu switch-account e vai retomar o OAuth;
     *          `opened` se o InAppBrowser OAuth foi aberto.
     */
    async startSuapOAuthLogin(
        options: { resumeAfterSwitch?: boolean } = {},
    ): Promise<'switched' | 'opened'> {
        this.ensureLoginObserver();
        this.lastError = '';
        this.lastSummary = null;

        // Mesmo padrão do Add site oficial: sair da sessão atual antes de
        // autenticar outra conta. Não apaga o site antigo nem o login IFRN.
        if (!options.resumeAfterSwitch && CoreSites.isLoggedIn()) {
            this.logger.debug(
                `${LOG_PREFIX} Sessão Moodle ativa — switch-account antes do OAuth SUAP`,
            );

            sessionStorage.setItem(POC_RESUME_OAUTH_KEY, '1');

            const pending = this.getPendingOpenCourse();
            const redirectPath = pending?.courseId
                ? '/login/moodle-open-course'
                : '/login/moodle-poc';
            const redirectOptions = pending?.courseId
                ? { params: { startOAuth: true, courseId: pending.courseId, courseName: pending.courseName } }
                : { params: { startOAuth: true } };

            await CoreSites.logout({
                siteId: NO_SITE_ID,
                redirectPath,
                redirectOptions,
            });

            return 'switched';
        }

        sessionStorage.removeItem(POC_RESUME_OAUTH_KEY);

        const targetSiteUrl = this.getPendingOpenCourse()?.siteUrl || IFRN_MOODLE_PRESENCIAL_URL;
        const siteCheck = await this.checkPresencialSite(targetSiteUrl);
        const provider = await this.findSuapProvider(siteCheck);

        if (!provider) {
            throw new Error(
                'Identity provider SUAP não encontrado em tool_mobile_get_public_config.',
            );
        }

        const oauthParams = CoreUrl.extractUrlParams(provider.url);

        if (!oauthParams.id) {
            throw new Error('Identity provider SUAP sem parâmetro id na URL OAuth.');
        }

        sessionStorage.setItem(POC_PENDING_KEY, '1');

        this.logger.debug(`${LOG_PREFIX} Abrindo OAuth SUAP em ${siteCheck.siteUrl}`);

        const loginUrl = await CoreLoginHelper.prepareForSSOLogin(
            siteCheck.siteUrl,
            undefined,
            siteCheck.config?.launchurl,
            undefined,
            { oauthsso: oauthParams.id },
        );

        // InAppBrowser + clearsessioncache: mesmo recurso do SSO embutido
        // ("allow for multiple logins"). Evita reutilizar cookie Moodle/SUAP
        // no navegador do sistema e força a tela de autenticação.
        CoreOpener.openInApp(loginUrl, {
            clearsessioncache: 'yes',
            closebuttoncaption: Translate.instant('core.login.cancel'),
        });

        return 'opened';
    }

    /**
     * Inspeciona a sessão atual e lista cursos via CoreCourses.getUserCourses().
     * Nunca registra token.
     */
    async inspectSessionAndCourses(): Promise<MoodlePocSessionSummary> {
        this.lastError = '';

        const site = CoreSites.getCurrentSite();

        if (!site || !CoreSites.isLoggedIn()) {
            throw new Error('Não há sessão Moodle ativa. Conecte via OAuth SUAP primeiro.');
        }

        const info = site.getInfo();
        const courses = await CoreCourses.getUserCourses();
        const courseSummaries = courses.map((course) => this.toCourseSummary(course));

        const summary: MoodlePocSessionSummary = {
            userFullName: info?.fullname || info?.username || '(sem nome)',
            username: info?.username || '',
            siteUrl: site.getURL(),
            siteName: info?.sitename || '',
            courseCount: courseSummaries.length,
            courses: courseSummaries,
        };

        this.logSessionSummary(summary);
        this.lastSummary = summary;

        return summary;
    }

    /**
     * Abre um curso com CoreCourseHelper.getAndOpenCourse.
     * Prefere 2836 se o usuário estiver inscrito; senão o primeiro da lista.
     */
    async openTestCourse(preferredCourseId = IFRN_MOODLE_POC_COURSE_ID): Promise<number> {
        this.lastError = '';

        if (!CoreSites.isLoggedIn()) {
            throw new Error('Não há sessão Moodle ativa.');
        }

        let summary = this.lastSummary;

        if (!summary) {
            summary = await this.inspectSessionAndCourses();
        }

        if (!summary.courses.length) {
            throw new Error('Nenhum curso encontrado para este usuário no Moodle.');
        }

        const preferred = summary.courses.find((course) => course.id === preferredCourseId);
        const target = preferred ?? summary.courses[0];

        this.logger.debug(
            `${LOG_PREFIX} Abrindo curso id=${target.id} name=${target.name}`
            + (preferred ? ' (preferido 2836)' : ' (primeiro da lista)'),
        );

        await CoreCourseHelper.getAndOpenCourse(target.id);

        summary.openedCourseId = target.id;
        this.lastSummary = summary;

        return target.id;
    }

    /**
     * checkSite no AVA-Presencial (public config + typeoflogin).
     */
    async checkPresencialSite(siteUrl = IFRN_MOODLE_PRESENCIAL_URL): Promise<CoreSiteCheckResponse> {
        return CoreSites.checkSite(
            siteUrl,
            'https://',
            'IFRN Moodle PoC',
        );
    }

    /**
     * Localiza o identity provider nomeado "suap" (oauth id=1 no AVA-Presencial).
     */
    async findSuapProvider(
        siteCheck: CoreSiteCheckResponse,
    ): Promise<CoreSiteIdentityProvider | undefined> {
        if (!siteCheck.config) {
            return undefined;
        }

        const tempSite = CoreSitesFactory.makeUnauthenticatedSite(
            siteCheck.siteUrl,
            siteCheck.config,
        );

        const providers = await CoreLoginHelper.getValidIdentityProvidersForSite(tempSite);

        const byName = providers.find(
            (provider) => provider.name.trim().toLowerCase() === 'suap',
        );

        if (byName) {
            return byName;
        }

        return providers.find(
            (provider) => Number(CoreUrl.extractUrlParams(provider.url).id) === 1,
        ) ?? providers[0];
    }

    /**
     * Após OAuth: inspeciona sessão; se houver curso pendente do painel, abre;
     * senão volta à página PoC.
     */
    private async afterOAuthLogin(): Promise<void> {
        try {
            await this.inspectSessionAndCourses();

            const pending = this.getPendingOpenCourse();

            if (pending?.courseId) {
                this.clearPendingOpenCourse();
                await this.openCourseById(pending.courseId);

                return;
            }

            await CoreNavigator.navigate('/login/moodle-poc', { animated: false });
        } catch (error) {
            this.lastError = error instanceof Error
                ? error.message
                : 'Falha ao inspecionar sessão Moodle após OAuth.';
            this.logger.error(`${LOG_PREFIX} ${this.lastError}`, error);

            const pending = this.getPendingOpenCourse();

            await CoreNavigator.navigate(
                pending?.courseId ? '/login/moodle-open-course' : '/login/moodle-poc',
                {
                    animated: false,
                    params: pending?.courseId
                        ? { courseId: pending.courseId, courseName: pending.courseName }
                        : undefined,
                },
            );
        }
    }

    private toCourseSummary(course: CoreEnrolledCourseData): MoodlePocCourseSummary {
        return {
            id: course.id,
            name: course.displayname || course.fullname || course.shortname || `Curso ${course.id}`,
        };
    }

    /**
     * Console seguro: nunca inclui token / privateToken.
     */
    private logSessionSummary(summary: MoodlePocSessionSummary): void {
        // eslint-disable-next-line no-console
        console.log(LOG_PREFIX, 'Sessão Moodle ativa');
        // eslint-disable-next-line no-console
        console.log(LOG_PREFIX, 'Usuário:', summary.userFullName, `(${summary.username})`);
        // eslint-disable-next-line no-console
        console.log(LOG_PREFIX, 'Site:', summary.siteUrl, `| ${summary.siteName}`);
        // eslint-disable-next-line no-console
        console.log(LOG_PREFIX, 'Cursos:', summary.courseCount);

        for (const course of summary.courses) {
            // eslint-disable-next-line no-console
            console.log(LOG_PREFIX, `  - [${course.id}] ${course.name}`);
        }
    }

}
