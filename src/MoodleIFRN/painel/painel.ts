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

import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { CoreSharedModule } from '@/core/shared.module';
import { CoreNavigator } from '@services/navigator';
import { CorePlatform } from '@services/platform';
import { AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { MoodleSiteService } from '@/MoodleIFRN/services_mobile/moodle-site.service';
import { resolveCourseSite } from '../mobilemoodle/core_mobile/course-target';
import { CoreAlerts } from '@services/overlays/alerts';
import { readPainelHostLayout } from '../navigation/painel-host-layout';
import { reportSuapDuration } from '../services_mobile/suap-login-telemetry';
import {
    type InternalBrowserPage,
    SUAP_PROFILE_PAGE,
    SuapProfileBrowserService,
} from '../services_mobile/suap-profile-browser.service';
import { getPainelHelpLink } from '../services_mobile/painel-help-links';
import { PainelNativeComponent } from './painel-native';
import { buildNativePainelModel, type NativePainelCourse, type NativePainelModel } from './painel-native-model';
import { readOAuthProfile } from '../mobilemoodle/core_mobile/oauth-profile';

export interface MoodleIfrnBridgeApi {
    openCourse: (courseId: number | string, courseName?: string, siteUrl?: string) => Promise<void>;
    openEnrol: (courseId: number | string, ambienteId?: number | string) => Promise<void>;
    goToMarketplace: () => Promise<void>;
    logout: () => Promise<void>;
}

@Component({
    selector: 'page-painel',
    templateUrl: './painel.html',
    styleUrls: ['./painel.scss'],
    imports: [CoreSharedModule, PainelNativeComponent],
})
export class PainelPage implements OnInit, OnDestroy {

    private readonly ngZone = inject(NgZone);
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly painelAva = inject(PainelAvaService);
    private readonly moodleSite = inject(MoodleSiteService);
    private readonly suapProfileBrowser = inject(SuapProfileBrowserService);
    private openingCourse = false;
    private bridgeApi?: MoodleIfrnBridgeApi;
    private painelStartedAt = 0;
    private painelFrameLoadReported = false;
    private destroyed = false;

    @ViewChild('painelFrame') painelFrame?: ElementRef<HTMLIFrameElement>;

    nativeDashboard: NativePainelModel | null = null;
    private hostAppearanceObserver?: MutationObserver;
    internalPageTitle = '';
    internalPageScreenOpen = false;
    internalPageLoading = false;
    internalPageError = '';
    private internalPageInBrowser = false;
    private currentInternalPage?: InternalBrowserPage;

    ngOnInit(): void {
        this.painelStartedAt = performance.now();

        this.loadNativeDashboard();

        this.registerBridge();
        document.addEventListener('resume', this.onAppResume);
        void this.refreshProfileWhenPlatformIsReady();
    }

    /**
     * Permite ao iframe começar a carregar os assets locais imediatamente.
     * A revalidação pode usar plugins Cordova, então continua após platform.ready.
     */
    private async refreshProfileWhenPlatformIsReady(): Promise<void> {
        await CorePlatform.ready();

        // Traduções e revalidação de perfil rodam em segundo plano enquanto o
        // iframe do Painel carrega, retirando a preparação do idioma do clique
        // na primeira disciplina. Uma falha de idioma continua sendo tentada
        // pelo fluxo normal de abertura do curso.
        const [updated] = await Promise.all([
            this.painelAva.refreshSavedProfile(),
            this.moodleSite.prepareCourseLanguage().catch(() => undefined),
        ]);
        if (updated) {
            this.reloadPainelFrame();
        }
    }

    /** Revalida o perfil ao voltar do segundo plano e atualiza o iframe se mudou. */
    private onAppResume = (): void => {
        void this.painelAva.refreshSavedProfile()
            .then(updated => {
                if (updated) {
                    this.reloadPainelFrame();
                }
            })
            .catch(() => undefined);
    };

    private reloadPainelFrame(): void {
        // Compatibility name for existing resume/profile callbacks: the UI is now Angular.
        this.loadNativeDashboard();
    }

    private loadNativeDashboard(): void {
        // getDashboard keeps the existing owner/expiry checks. No new authentication/cache path.
        const raw = this.painelAva.getDashboard();
        this.nativeDashboard = buildNativePainelModel(raw, readOAuthProfile()?.profile || this.painelAva.getProfile());
    }

    get nativeCourseOpening(): boolean {
        return this.openingCourse;
    }

    async onNativeCourse(course: NativePainelCourse): Promise<void> {
        const id = course.moodle_course_id;
        if (!Number.isSafeInteger(id) || !id || id < 0 || !course.moodle_site_url || this.openingCourse) {
            return;
        }
        if (course.is_enrolled === false) {
            this.openingCourse = true;
            try {
                await this.handleOpenEnrol(id, course.ambiente?.id);
            } finally {
                this.openingCourse = false;
            }
        } else {
            await this.handleOpenCourse(id, course.name, course.moodle_site_url);
        }
    }

    onNativeHelp(id: string): void { this.openHelpLink(id); }
    async onNativeEnrolment(course: NativePainelCourse): Promise<void> {
        if (!course.moodle_course_id || !course.moodle_site_url || this.openingCourse) {
            return;
        }
        this.openingCourse = true;
        try {
            await this.handleOpenEnrol(course.moodle_course_id, course.ambiente?.id);
        } finally {
            this.openingCourse = false;
        }
    }
    onNativeProfile(): void { this.openSuapProfile(); }
    onNativeMarketplace(): void { void this.handleGoToMarketplace(); }
    onNativeLogout(): void { void this.handleLogout(); }
    onNativeRefresh(): void {
        this.loadNativeDashboard();
        void this.refreshProfileWhenPlatformIsReady();
    }

    onPainelFrameLoad(): void {
        if (this.painelFrameLoadReported || !this.painelStartedAt) {
            return;
        }

        this.painelFrameLoadReported = true;
        reportSuapDuration('panel-iframe-document-load', performance.now() - this.painelStartedAt);
    }

    ngOnDestroy(): void {
        this.destroyed = true;
        document.removeEventListener('resume', this.onAppResume);
        this.painelAva.stopProfileRefresh();
        this.suapProfileBrowser.close();
        this.hostAppearanceObserver?.disconnect();
        this.unregisterBridge();
    }

    ionViewDidEnter(): void {
        this.registerBridge();
        this.loadNativeDashboard();
        // O menu nativo só perde o contexto azul quando a entrada do painel terminou.
        document.documentElement.classList.remove('ifrn-course-context');
    }

    private registerBridge(): void {
        this.bridgeApi ??= {
            openCourse: (courseId: number | string, courseName?: string, siteUrl?: string) =>
                this.ngZone.run(() => this.handleOpenCourse(courseId, courseName, siteUrl)),
            openEnrol: (courseId: number | string, ambienteId?: number | string) =>
                this.handleOpenEnrol(courseId, ambienteId),
            goToMarketplace: () => this.handleGoToMarketplace(),
            logout: () => this.handleLogout(),
        };
        (window as { MoodleIfrnBridge?: MoodleIfrnBridgeApi }).MoodleIfrnBridge = this.bridgeApi;

        window.addEventListener('message', this.onWindowMessage);
    }

    private unregisterBridge(): void {
        window.removeEventListener('message', this.onWindowMessage);
        const win = window as { MoodleIfrnBridge?: MoodleIfrnBridgeApi };
        if (win.MoodleIfrnBridge === this.bridgeApi) {
            delete win.MoodleIfrnBridge;
        }
    }

    private onWindowMessage = (event: MessageEvent): void => {
        if (event.source !== this.painelFrame?.nativeElement.contentWindow || event.origin !== window.location.origin) {
            return;
        }
        const data = event.data;
        if (!data || typeof data !== 'object') {
            return;
        }

        switch (data.type) {
            case 'MOODLE_IFRN_OPEN_COURSE':
                void this.handleOpenCourse(data.courseId, data.courseName, data.siteUrl);
                break;
            case 'MOODLE_IFRN_OPEN_ENROL':
                void this.handleOpenEnrol(data.courseId, data.ambienteId);
                break;
            case 'MOODLE_IFRN_LOGOUT':
                void this.handleLogout();
                break;
            case 'MOODLE_IFRN_MARKETPLACE':
                void this.handleGoToMarketplace();
                break;
            case 'MOODLE_IFRN_OPEN_SUAP_PROFILE':
                this.openSuapProfile();
                break;
            case 'MOODLE_IFRN_OPEN_HELP_LINK':
                this.openHelpLink(data.helpId);
                break;
        }
    };

    private openSuapProfile(): void {
        this.openInternalPage(SUAP_PROFILE_PAGE);
    }

    private openHelpLink(helpId: unknown): void {
        const page = getPainelHelpLink(helpId);
        if (!page) {
            return;
        }

        this.openInternalPage(page);
    }

    private openInternalPage(page: InternalBrowserPage, retry = false): void {
        if (this.openingCourse || this.internalPageLoading || this.internalPageInBrowser
            || (this.internalPageScreenOpen && !retry)) {
            return;
        }

        this.currentInternalPage = page;
        this.internalPageTitle = page.title;
        this.internalPageScreenOpen = true;
        this.internalPageLoading = true;
        this.internalPageError = '';
        this.suapProfileBrowser.openPage(page, {
            onReady: () => {
                if (this.destroyed) {
                    return;
                }
                this.internalPageLoading = false;
                this.internalPageInBrowser = true;
                this.internalPageScreenOpen = false;
            },
            onError: message => {
                if (this.destroyed) {
                    return;
                }
                this.internalPageLoading = false;
                this.internalPageInBrowser = false;
                this.internalPageError = message;
                this.internalPageScreenOpen = true;
            },
            onExit: () => {
                if (this.destroyed) {
                    return;
                }
                this.internalPageLoading = false;
                this.internalPageInBrowser = false;
                if (!this.internalPageError) {
                    this.internalPageScreenOpen = false;
                }
            },
        });
    }

    retryInternalPage(): void {
        if (this.currentInternalPage) {
            this.openInternalPage(this.currentInternalPage, true);
        }
    }

    closeInternalPageScreen(): void {
        this.suapProfileBrowser.close();
        this.internalPageScreenOpen = false;
        this.internalPageLoading = false;
        this.internalPageInBrowser = false;
        this.internalPageError = '';
    }

    onInternalPageScreenDismiss(): void {
        if (this.internalPageInBrowser) {
            return;
        }

        this.closeInternalPageScreen();
    }

    private async handleOpenCourse(
        courseId: number | string,
        courseName?: string,
        siteUrl?: string,
    ): Promise<void> {
        const id = Number(courseId);
        if (!Number.isSafeInteger(id) || id <= 0 || this.openingCourse) {
            return;
        }
        const target = resolveCourseSite({ viewurl: siteUrl });
        if (!target) {
            await CoreAlerts.showError('Não foi possível confirmar o ambiente deste curso. Atualize o Painel.');

            return;
        }

        this.openingCourse = true;
        this.painelAva.stopProfileRefresh();
        try {
            sessionStorage.setItem('ifrn_moodle_last_site_url', target);
        } catch {
            // A preferência de logout web não impede a abertura nativa.
        }
        let identityOnly = false;
        try {
            // Recupera também contas persistidas após reiniciar o app. Com sessão
            // válida, o clique termina no curso nativo sem passar pela ponte OAuth.
            const result = await this.moodleSite.ensureSessionAndOpenCourse(id, target, courseName);
            if (result === 'opened' || result === 'cancelled') {
                this.openingCourse = false;

                return;
            }
        } catch (error) {
            // Rede, permissão ou identidade não autorizam iniciar outra autenticação.
            this.moodleSite.lastError = error instanceof Error ? error.message : 'Não foi possível abrir o curso.';
            identityOnly = true;
        }

        try {
            // A ponte é aberta diretamente pelo Router: o navigateRoot do
            // NavController pode ficar pendente quando a origem é o iframe
            // do Painel e impedir que o próprio fluxo OAuth comece.
            await this.router.navigate(['/login/moodle-open-course'], {
                replaceUrl: true,
                queryParams: {
                    courseId: id,
                    courseName: courseName || '',
                    siteUrl: target,
                    identityOnly,
                    startOAuth: false,
                },
            });
        } finally {
            this.openingCourse = false;
        }
    }

    private async handleOpenEnrol(
        courseId: number | string,
        ambienteId?: number | string,
    ): Promise<void> {
        const id = Number(courseId);
        const envId = Number(ambienteId || 2);

        try {
            sessionStorage.setItem('ifrn_painel_pending_enrol', JSON.stringify({
                courseId: id,
                ambienteId: envId,
            }));
        } catch {
            // ignore storage quota
        }

        await CoreNavigator.navigate('/login/painel-enrol', {
            params: {
                courseId: id,
                ambienteId: envId,
            },
        });
    }

    private async handleGoToMarketplace(): Promise<void> {
        await CoreNavigator.navigate('/login/marketplace-ifrn');
    }

    private async handleLogout(): Promise<void> {
        this.authService.logout();
        this.painelAva.clearSession();
        await CoreNavigator.navigate('/login/marketplace-ifrn', { reset: true });
    }

    onIframeLoad(): void {
        this.onPainelFrameLoad();
        this.hostAppearanceObserver?.disconnect();
        this.syncFrameAppearance();
        this.hostAppearanceObserver = new MutationObserver(() => this.syncFrameAppearance());
        this.hostAppearanceObserver.observe(document.documentElement, {
            attributes: true, attributeFilter: ['style', 'class'],
        });
    }

    private syncFrameAppearance(): void {
        try {
            const frame = this.painelFrame?.nativeElement;
            const doc = frame?.contentDocument || frame?.contentWindow?.document;
            if (doc) {
                doc.documentElement.classList.toggle('dark', document.documentElement.classList.contains('dark'));
                const layout = readPainelHostLayout(window);
                if (layout) {
                    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
                        doc.documentElement.style.setProperty(`--ion-safe-area-${side}`, `${layout.insets[side]}px`);
                    }
                }
            }
        } catch {
            // ignore cross-origin restrictions in edge environments
        }
    }

}
