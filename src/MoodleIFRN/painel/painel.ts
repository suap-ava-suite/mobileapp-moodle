import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CoreSharedModule } from '@/core/shared.module';
import { CoreNavigator } from '@services/navigator';
import { CoreLang } from '@services/lang';
import { CorePlatform } from '@services/platform';
import { AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { MoodleSiteService } from '@/MoodleIFRN/services_mobile/moodle-site.service';
import { resolveCourseSite } from '../mobilemoodle/core_mobile/course-target';
import { CoreAlerts } from '@services/overlays/alerts';
import { readPainelHostLayout } from '../navigation/painel-host-layout';

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
    imports: [CoreSharedModule],
})
export class PainelPage implements OnInit, OnDestroy {

    private readonly sanitizer = inject(DomSanitizer);
    private readonly authService = inject(AuthService);
    private readonly painelAva = inject(PainelAvaService);
    private readonly moodleSite = inject(MoodleSiteService);
    private openingCourse = false;
    private bridgeApi?: MoodleIfrnBridgeApi;

    @ViewChild('painelFrame') painelFrame?: ElementRef<HTMLIFrameElement>;

    safePainelUrl?: SafeResourceUrl;
    private hostAppearanceObserver?: MutationObserver;

    async ngOnInit(): Promise<void> {
        await CorePlatform.ready();

        const base = document.querySelector('base')?.getAttribute('href') || '/';
        const root = base.endsWith('/') ? base : `${base}/`;
        const language = CoreLang.getCurrentLanguageSync();
        const langParam = language ? `?lang=${encodeURIComponent(language)}` : '';
        const url = `${root}mobilemoodle/index.html${langParam}#/painel`;

        this.safePainelUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

        this.registerBridge();
        void this.painelAva.refreshSavedProfile().then(updated => {
            if (updated) {
                this.painelFrame?.nativeElement.contentWindow?.location.reload();
            }
        });
    }

    ngOnDestroy(): void {
        this.painelAva.stopProfileRefresh();
        this.hostAppearanceObserver?.disconnect();
        this.unregisterBridge();
    }

    ionViewDidEnter(): void {
        this.registerBridge();
        // O menu nativo só perde o contexto azul quando a entrada do painel terminou.
        document.documentElement.classList.remove('ifrn-course-context');
    }

    private registerBridge(): void {
        this.bridgeApi ??= {
            openCourse: (courseId: number | string, courseName?: string, siteUrl?: string) =>
                this.handleOpenCourse(courseId, courseName, siteUrl),
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
        }
    };

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
            if (result === 'opened') {
                this.openingCourse = false;

                return;
            }
        } catch (error) {
            // Rede, permissão ou identidade não autorizam iniciar outra autenticação.
            this.moodleSite.lastError = error instanceof Error ? error.message : 'Não foi possível abrir o curso.';
            identityOnly = true;
        }

        try {
            await CoreNavigator.navigate('/login/moodle-open-course', {
                params: {
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
