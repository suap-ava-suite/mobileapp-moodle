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
import { Router } from '@angular/router';
import { CoreSharedModule } from '@/core/shared.module';
import {
    IFRN_MOODLE_POC_COURSE_ID,
    IFRN_MOODLE_PRESENCIAL_URL,
    MoodlePocSessionSummary,
    MoodleSiteService,
} from '@/MoodleIFRN/services_mobile/moodle-site.service';
import { CoreNavigator } from '@services/navigator';
import { CoreAlerts } from '@services/overlays/alerts';
import { CoreLoadings } from '@services/overlays/loadings';
import { CorePlatform } from '@services/platform';

/**
 * PoC temporário: OAuth SUAP do Moodle → CoreSites → cursos → abertura nativa.
 * Rota: /login/moodle-poc
 */
@Component({
    selector: 'page-moodle-poc',
    templateUrl: './moodle-poc.html',
    styleUrls: ['./moodle-poc.scss'],
    imports: [
        CoreSharedModule,
    ],
})
export class MoodlePocPage implements OnInit {

    private readonly moodleSite = inject(MoodleSiteService);
    private readonly router = inject(Router);

    readonly siteUrl = IFRN_MOODLE_PRESENCIAL_URL;
    readonly preferredCourseId = IFRN_MOODLE_POC_COURSE_ID;

    loading = false;
    statusMessage = '';
    formError = '';
    hasSession = false;
    summary: MoodlePocSessionSummary | null = null;

    async ngOnInit(): Promise<void> {
        await CorePlatform.ready();

        this.moodleSite.ensureLoginObserver();
        this.refreshFromService();

        // Retorno do switch-account (mesmo padrão do Add site oficial).
        const startOAuth = CoreNavigator.getRouteBooleanParam('startOAuth')
            || this.moodleSite.shouldResumeOAuthAfterSiteSwitch();

        if (startOAuth) {
            await this.connectSuapOAuth({ resumeAfterSwitch: true });

            return;
        }

        // Sessão restaurada pelo CoreSites ≠ OAuth do PoC. Só informa;
        // "Conectar" sempre inicia autenticação explícita.
        if (this.hasSession && !this.summary) {
            this.statusMessage =
                'Sessão Moodle já armazenada no app. '
                + 'Use "Conectar via SUAP OAuth" para autenticar outra conta, '
                + 'ou "Listar cursos" para inspecionar a sessão atual.';
        }
    }

    goBack(): void {
        if (this.loading) {
            return;
        }

        void this.router.navigate(['/login/marketplace-ifrn']);
    }

    /**
     * Abre o navegador no OAuth SUAP do AVA-Presencial.
     * Não reutiliza silenciosamente a sessão Moodle já restaurada.
     */
    async connectSuapOAuth(options: { resumeAfterSwitch?: boolean } = {}): Promise<void> {
        if (this.loading) {
            return;
        }

        this.formError = '';
        this.loading = true;
        this.statusMessage = options.resumeAfterSwitch
            ? 'Sessão anterior deixada (switch-account). Abrindo OAuth SUAP…'
            : 'Abrindo autenticação SUAP no Moodle…';

        try {
            const result = await this.moodleSite.startSuapOAuthLogin(options);

            this.statusMessage = result === 'switched'
                ? 'Saindo da sessão Moodle atual (conta permanece salva) para autenticar outra…'
                : 'Complete o login SUAP no navegador. Ao voltar, a sessão Moodle será inspecionada.';
        } catch (error) {
            this.statusMessage = '';
            this.formError = error instanceof Error
                ? error.message
                : 'Não foi possível iniciar o OAuth SUAP.';
            void CoreAlerts.showError(error, {
                default: 'Não foi possível iniciar o OAuth SUAP.',
            });
        } finally {
            this.loading = false;
        }
    }

    /**
     * Lista cursos com CoreCourses.getUserCourses() e loga no console.
     */
    async listCourses(): Promise<void> {
        if (this.loading) {
            return;
        }

        this.formError = '';
        this.loading = true;
        this.statusMessage = 'Buscando cursos Moodle…';

        const modal = await CoreLoadings.show('Buscando cursos…');

        try {
            this.summary = await this.moodleSite.inspectSessionAndCourses();
            this.hasSession = true;
            this.statusMessage =
                `${this.summary.courseCount} curso(s) encontrados. Detalhes no console.`;
        } catch (error) {
            this.statusMessage = '';
            this.formError = error instanceof Error
                ? error.message
                : 'Falha ao listar cursos.';
            void CoreAlerts.showError(error, {
                default: 'Falha ao listar cursos Moodle.',
            });
        } finally {
            modal.dismiss();
            this.loading = false;
        }
    }

    /**
     * Abre o curso 2836 (se inscrito) ou o primeiro da lista.
     */
    async openCourse(): Promise<void> {
        if (this.loading) {
            return;
        }

        this.formError = '';
        this.loading = true;
        this.statusMessage = 'Abrindo curso no Moodle Mobile…';

        const modal = await CoreLoadings.show('Abrindo curso…');

        try {
            const courseId = await this.moodleSite.openTestCourse(
                this.preferredCourseId,
            );
            this.summary = this.moodleSite.lastSummary;
            this.statusMessage = `Curso ${courseId} aberto via CoreCourseHelper.`;
        } catch (error) {
            this.statusMessage = '';
            this.formError = error instanceof Error
                ? error.message
                : 'Falha ao abrir o curso.';
            void CoreAlerts.showError(error, {
                default: 'Falha ao abrir o curso Moodle.',
            });
        } finally {
            modal.dismiss();
            this.loading = false;
        }
    }

    private refreshFromService(): void {
        this.hasSession = this.moodleSite.hasPresencialSession();
        this.summary = this.moodleSite.lastSummary;
        this.formError = this.moodleSite.lastError || '';

        if (this.summary) {
            this.statusMessage =
                `Sessão ativa: ${this.summary.userFullName} — ${this.summary.courseCount} curso(s).`;
        } else if (this.hasSession) {
            this.statusMessage =
                'Sessão Moodle detectada (restaurada pelo app). '
                + 'Não é o resultado do botão Conectar — use OAuth para outra conta.';
        }
    }

}
