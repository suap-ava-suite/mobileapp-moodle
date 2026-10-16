import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CoreSharedModule } from '@/core/shared.module';
import { CoreNavigator } from '@services/navigator';
import { CoreLang } from '@services/lang';
import { CorePlatform } from '@services/platform';
import { AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';

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

    @ViewChild('painelFrame') painelFrame?: ElementRef<HTMLIFrameElement>;

    safePainelUrl?: SafeResourceUrl;

    async ngOnInit(): Promise<void> {
        await CorePlatform.ready();

        const base = document.querySelector('base')?.getAttribute('href') || '/';
        const root = base.endsWith('/') ? base : `${base}/`;
        const language = CoreLang.getCurrentLanguageSync();
        const langParam = language ? `?lang=${encodeURIComponent(language)}` : '';
        const url = `${root}mobilemoodle/index.html${langParam}#/painel`;

        this.safePainelUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

        this.registerBridge();
    }

    ngOnDestroy(): void {
        this.unregisterBridge();
    }

    private registerBridge(): void {
        (window as { MoodleIfrnBridge?: MoodleIfrnBridgeApi }).MoodleIfrnBridge = {
            openCourse: (courseId: number | string, courseName?: string, siteUrl?: string) =>
                this.handleOpenCourse(courseId, courseName, siteUrl),
            openEnrol: (courseId: number | string, ambienteId?: number | string) =>
                this.handleOpenEnrol(courseId, ambienteId),
            goToMarketplace: () => this.handleGoToMarketplace(),
            logout: () => this.handleLogout(),
        };

        window.addEventListener('message', this.onWindowMessage);
    }

    private unregisterBridge(): void {
        window.removeEventListener('message', this.onWindowMessage);
        const win = window as { MoodleIfrnBridge?: MoodleIfrnBridgeApi };
        if (win.MoodleIfrnBridge) {
            delete win.MoodleIfrnBridge;
        }
    }

    private onWindowMessage = (event: MessageEvent): void => {
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
        if (!Number.isFinite(id) || id <= 0) {
            return;
        }

        try {
            sessionStorage.setItem('ifrn_moodle_pending_open_course', JSON.stringify({
                courseId: id,
                courseName: courseName || undefined,
                siteUrl: siteUrl || undefined,
            }));
            if (siteUrl && /^https:\/\//i.test(siteUrl)) {
                sessionStorage.setItem('ifrn_moodle_last_site_url', new URL(siteUrl).origin);
            }
        } catch {
            // ignore storage quota
        }

        await CoreNavigator.navigate('/login/moodle-open-course', {
            params: {
                courseId: id,
                courseName: courseName || '',
                siteUrl: siteUrl || '',
            },
        });
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
        try {
            const frame = this.painelFrame?.nativeElement;
            const doc = frame?.contentDocument || frame?.contentWindow?.document;
            if (doc) {
                const safeTop = getComputedStyle(document.documentElement).getPropertyValue('--ion-safe-area-top');
                if (safeTop && safeTop.trim()) {
                    doc.documentElement.style.setProperty('--ion-safe-area-top', safeTop);
                }
            }
        } catch {
            // ignore cross-origin restrictions in edge environments
        }
    }
}
