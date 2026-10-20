import { backendConfig } from '../services_mobile/backend.config';
import { mockApi, MockCourse, MockDashboard } from '../services_mobile/mock-api';
import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CoreSharedModule } from '@/core/shared.module';
import { CoreNavigator } from '@services/navigator';
import { CoreLang } from '@services/lang';
import { CorePlatform } from '@services/platform';
import { AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { readPainelHostLayout } from '../navigation/painel-host-layout';

export interface MoodleIfrnBridgeApi {
    mockDashboard?: () => Promise<MockDashboard>;
    mockCourse?: (id: number) => Promise<MockCourse>;
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
    }

    ngOnDestroy(): void {
        this.hostAppearanceObserver?.disconnect();
        this.unregisterBridge();
    }

    ionViewDidEnter(): void {
        // O menu nativo só perde o contexto azul quando a entrada do painel terminou.
        document.documentElement.classList.remove('ifrn-course-context');
    }

    private registerBridge(): void {
        (window as { MoodleIfrnBridge?: MoodleIfrnBridgeApi }).MoodleIfrnBridge = {
            ...(backendConfig.provider === 'mock' ? {
                mockDashboard: () => mockApi.get<MockDashboard>('/api/v1/dashboard'),
                mockCourse: (id: number) => {
                    if (!Number.isSafeInteger(id) || id <= 0) return Promise.reject(new Error('Curso inválido'));
                    return mockApi.get<MockCourse>(`/api/v1/courses/${id}`);
                },
            } : {}),
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
        if (event.source !== this.painelFrame?.nativeElement.contentWindow || event.origin !== window.location.origin) return;
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
        if (backendConfig.provider === 'mock') return;
        const id = Number(courseId);
        if (!Number.isFinite(id) || id <= 0) {
            return;
        }

        try {
            sessionStorage.setItem('ifrn_moodle_pending_open_course', JSON.stringify({
                courseId: id,
                owner: sessionStorage.getItem('ifrn_painel_owner') || undefined,
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
        if (backendConfig.provider === 'mock') return;
        const id = Number(courseId);
        const envId = Number(ambienteId);
        if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(envId) || envId <= 0) {
            window.alert('Ambiente ou curso não identificado. Atualize o Painel.');
            return;
        }

        try {
            sessionStorage.setItem('ifrn_painel_pending_enrol', JSON.stringify({
                courseId: id,
                owner: sessionStorage.getItem('ifrn_painel_owner') || undefined,
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
        if (backendConfig.provider === 'mock') {
            try { await mockApi.logout(); }
            finally { await CoreNavigator.navigate('/login/marketplace-ifrn', { reset: true }); }
            return;
        }
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
