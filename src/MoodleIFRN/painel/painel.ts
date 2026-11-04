import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CoreSharedModule } from '@/core/shared.module';
import { CoreNavigator } from '@services/navigator';
import { CorePlatform } from '@services/platform';
import { AuthService } from '@/MoodleIFRN/services_mobile/auth.service';
import { PainelAvaService } from '@/MoodleIFRN/services_mobile/painel-ava.service';
import { resolveCourseSite } from '../mobilemoodle/core_mobile/course-target';
import { CoreAlerts } from '@services/overlays/alerts';
import { reportSuapDuration } from '../services_mobile/suap-login-telemetry';
import { useIfrnBrazilianPortuguese } from '../services_mobile/ifrn-language';
import { PainelCourseCardComponent } from './painel-course-card';
import { PainelDashboardService } from './painel-dashboard.service';

type PainelModal = 'profile' | 'help' | 'accessibility' | 'filter' | null;
type A11yKey = 'dyslexia_friendly' | 'highlight_links' | 'stop_animations' | 'hidden_illustrative_image' | 'big_cursor' | 'vlibras_active' | 'high_line_height';

@Component({
    selector: 'page-painel',
    templateUrl: './painel.html',
    styleUrls: ['./painel.scss'],
    imports: [CoreSharedModule, PainelCourseCardComponent],
})
export class PainelPage implements OnInit, OnDestroy {
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly painelAva = inject(PainelAvaService);
    readonly dashboardService = inject(PainelDashboardService);
    private openingCourse = false;
    private modalTrigger?: HTMLElement;
    private painelStartedAt = 0;
    private profileRefreshTimer?: number;
    readonly zoomLevels = [100, 120, 130, 150, 160];
    readonly colorModes = ['default', 'high_contrast', 'low_contrast', 'colorblind', 'grayscale'];

    loading = true;
    userName = 'Estudante';
    initials = 'E';
    avatarUrl = '';
    activeTab: PainelTabKey = 'diarios';
    activeFilter = 'allincludinghidden';
    pendingFilter = 'allincludinghidden';
    modalType: PainelModal = null;
    lists: Record<PainelTabKey, DashboardCourse[]> = { diarios: [], coordenacoes: [], autoinscricoes: [] };
    zoom = 100;
    colorMode = 'default';
    a11y: Record<A11yKey, boolean> = {
        dyslexia_friendly: false, highlight_links: false, stop_animations: false, hidden_illustrative_image: false,
        big_cursor: false, vlibras_active: false, high_line_height: false,
    };
    readonly tabs = [
        { key: 'diarios' as const, desktop: 'Meus Diários', mobile: 'Diários' },
        { key: 'coordenacoes' as const, desktop: 'Salas de Coordenação', mobile: 'Coordenação' },
        { key: 'autoinscricoes' as const, desktop: 'Cursos com Autoinscrição', mobile: 'Autoinscrição' },
    ];
    readonly filterLabels: Record<string, string> = {
        inprogress: 'Em andamento', allincludinghidden: 'Todos os diários', favourites: 'Favoritos', hidden: 'Ocultos',
    };
    readonly accessibilityOptions: { key: A11yKey; label: string; icon: string }[] = [
        { key: 'dyslexia_friendly', label: 'Fonte amigável a disléxicos', icon: 'reader-outline' }, { key: 'highlight_links', label: 'Destacar links', icon: 'color-fill-outline' },
        { key: 'stop_animations', label: 'Parar animações', icon: 'pause-circle-outline' }, { key: 'hidden_illustrative_image', label: 'Ocultar imagens ilustrativas', icon: 'image-outline' },
        { key: 'big_cursor', label: 'Cursor do mouse grande', icon: 'navigate-outline' }, { key: 'vlibras_active', label: 'Habilitar VLibras', icon: 'hand-left-outline' },
        { key: 'high_line_height', label: 'Linhas mais distantes', icon: 'menu-outline' },
    ];

    get visibleCourses(): DashboardCourse[] {
        const courses = this.lists[this.activeTab] || [];
        return this.activeFilter === 'favourites' ? courses.filter(course => this.dashboardService.isFavourite(course)) : courses;
    }
    get activeTabTitle(): string { return this.tabs.find(tab => tab.key === this.activeTab)?.desktop || 'Meus Diários'; }
    get emptyTitle(): string {
        return this.activeFilter === 'favourites' ? 'Nenhum favorito encontrado.' : 'Nenhum resultado encontrado nesta aba.';
    }
    get emptyMessage(): string {
        if (this.activeFilter === 'favourites') return 'Marque um curso com a estrela para encontrá-lo aqui.';
        if (this.activeTab === 'coordenacoes') return 'Não há salas de coordenação disponíveis para este usuário.';
        if (this.activeTab === 'autoinscricoes') return 'Não há cursos com autoinscrição disponíveis no momento. Ajuste os filtros ou volte mais tarde.';
        return 'É possível que a Secretaria Acadêmica ainda não tenha lhe inserido em diário algum; neste caso, aguarde.';
    }
    get modalTitle(): string { return ({ profile: 'Perfil', help: 'Ajuda', accessibility: 'Acessibilidade', filter: 'Filtros' } as const)[this.modalType as Exclude<PainelModal, null>] || ''; }
    get modalIcon(): string { return ({ profile: 'person-circle-outline', help: 'help-circle-outline', accessibility: 'accessibility-outline', filter: 'filter-outline' } as const)[this.modalType as Exclude<PainelModal, null>] || ''; }
    get colorModeLabel(): string {
        return ({ default: 'Padrão', high_contrast: 'Alto contraste', low_contrast: 'Contraste reduzido', colorblind: 'Amigável a daltônicos', grayscale: 'Escala de cinza' } as Record<string, string>)[this.colorMode] || 'Padrão';
    }

    async ngOnInit(): Promise<void> {
        this.painelStartedAt = performance.now();
        // Reidrata o cartão e a foto do storage antes de qualquer espera do runtime.
        const dashboard = this.dashboardService.getDashboard();
        if (dashboard) {
            this.lists = this.dashboardService.getLists(dashboard);
            this.userName = dashboard.nome || dashboard.username || 'Estudante';
            this.avatarUrl = dashboard.foto_url || dashboard.foto || dashboard.avatar_url || '';
            this.initials = this.userName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'E';
            this.activeFilter = dashboard.filtro_situacao || dashboard.situacao || dashboard.filter_situacao || 'allincludinghidden';
            this.pendingFilter = this.activeFilter;
        }
        this.loadAccessibility();
        this.loading = false;
        // Prepara a localização em paralelo para não cobrar esse custo no primeiro toque do curso.
        const platformReady = CorePlatform.ready();
        void platformReady.then(() => useIfrnBrazilianPortuguese()).catch(() => undefined);
        await platformReady;
        reportSuapDuration('panel-angular-render', performance.now() - this.painelStartedAt);
        // O endpoint de refresh atualiza nomes, não a foto. Faça essa consulta
        // depois do primeiro paint e não a cada retorno rápido de um curso.
        this.profileRefreshTimer = window.setTimeout(() => {
            void this.painelAva.refreshSavedProfile().then(updated => {
                if (updated) {
                    const refreshed = this.dashboardService.getDashboard();
                    if (refreshed) {
                        this.userName = refreshed.nome || refreshed.username || this.userName;
                        this.avatarUrl = refreshed.foto_url || refreshed.foto || refreshed.avatar_url || this.avatarUrl;
                    }
                    this.initials = this.userName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'E';
                }
            });
        }, 1800);
    }

    ngOnDestroy(): void {
        if (this.profileRefreshTimer !== undefined) window.clearTimeout(this.profileRefreshTimer);
        this.painelAva.stopProfileRefresh();
    }
    ionViewDidEnter(): void { document.documentElement.classList.remove('ifrn-course-context'); }
    @HostListener('document:keydown', ['$event']) onModalKeydown(event: KeyboardEvent): void {
        if (!this.modalType) return;
        if (event.key === 'Escape') { event.preventDefault(); this.closeModal(); return; }
        if (event.key !== 'Tab') return;
        const dialog = document.querySelector<HTMLElement>('.sidebar-modal__panel');
        const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])') || [])
            .filter(element => element.getClientRects().length > 0);
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    selectTab(tab: PainelTabKey): void { this.activeTab = tab; }
    trackCourse(_index: number, course: DashboardCourse): string { return `${course.moodle_site_url || course.viewurl || ''}:${course.moodle_course_id || course.id}`; }
    openModal(type: Exclude<PainelModal, null>): void {
        this.modalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
        this.pendingFilter = this.activeFilter;
        this.modalType = type;
        requestAnimationFrame(() => document.querySelector<HTMLElement>('.sidebar-modal__close')?.focus());
    }
    closeModal(): void {
        this.modalType = null;
        requestAnimationFrame(() => this.modalTrigger?.isConnected && this.modalTrigger.focus());
    }
    applyFilter(): void { this.activeFilter = this.pendingFilter; this.closeModal(); }
    clearFilter(): void { this.pendingFilter = this.activeFilter = 'allincludinghidden'; }

    toggleFavourite(course: DashboardCourse): void {
        try { this.dashboardService.toggleFavourite(course); }
        catch { void CoreAlerts.showError('Não foi possível salvar o favorito neste aparelho. Tente novamente.'); }
    }

    private async openCourseById(courseId: number | string, courseName?: string, siteUrl?: string): Promise<void> {
        const id = Number(courseId);
        if (!Number.isSafeInteger(id) || id <= 0 || this.openingCourse) return;
        const target = resolveCourseSite({ viewurl: siteUrl });
        if (!target) { await CoreAlerts.showError('Não foi possível confirmar o ambiente deste curso. Atualize o Painel.'); return; }
        this.openingCourse = true;
        this.painelAva.stopProfileRefresh();
        try { sessionStorage.setItem('ifrn_moodle_last_site_url', target); } catch { /* optional preference */ }
        try {
            await this.router.navigate(['/login/moodle-open-course'], { replaceUrl: true, queryParams: {
                courseId: id, courseName: courseName || '', siteUrl: target, identityOnly: false, startOAuth: false,
            } });
        } finally { this.openingCourse = false; }
    }

    openCourse(course: DashboardCourse): void {
        const moodleCourseId = course.moodle_course_id ?? (course.source === 'painel' ? Number(course.id) : NaN);
        void this.openCourseById(moodleCourseId, course.name || course.fullname, resolveCourseSite(course));
    }
    enrolCourse(course: DashboardCourse): void {
        const courseId = course.moodle_course_id ?? (course.source === 'painel' ? Number(course.id) : NaN);
        if (!Number.isFinite(courseId) || courseId <= 0) {
            void CoreAlerts.showError('Não foi possível identificar este curso para autoinscrição.');
            return;
        }
        void this.handleOpenEnrol(courseId, course.ambiente?.id);
    }
    cancelEnrol(): void {
        window.alert('O cancelamento de inscrição será liberado com a API de autoinscrição.');
    }
    private async handleOpenEnrol(courseId: number | string, ambienteId?: number | string): Promise<void> {
        const id = Number(courseId); const envId = Number(ambienteId || 2);
        try { sessionStorage.setItem('ifrn_painel_pending_enrol', JSON.stringify({ courseId: id, ambienteId: envId })); } catch { /* optional */ }
        this.closeModal();
        await CoreNavigator.navigate('/login/painel-enrol', { params: { courseId: id, ambienteId: envId } });
    }
    async logout(): Promise<void> {
        this.closeModal(); this.authService.logout(); this.painelAva.clearSession();
        await CoreNavigator.navigate('/login/marketplace-ifrn', { reset: true });
    }

    private loadAccessibility(): void {
        try {
            const saved = JSON.parse(localStorage.getItem('ifrn_a11y_prefs') || '{}') as Record<string, unknown>;
            for (const option of this.accessibilityOptions) this.a11y[option.key] = saved[option.key] === true;
            const zoom = Number(saved['zoom_level']); if (this.zoomLevels.includes(zoom)) this.zoom = zoom;
            const mode = String(saved['color_mode'] || 'default'); if (this.colorModes.includes(mode)) this.colorMode = mode;
        } catch { /* ignore invalid local preferences */ }
        this.applyAccessibility();
    }
    setAccessibility(key: A11yKey, value: boolean): void { this.a11y[key] = value; this.saveAccessibility(); this.applyAccessibility(); }
    cycleZoom(): void { this.zoom = this.zoomLevels[(this.zoomLevels.indexOf(this.zoom) + 1) % this.zoomLevels.length]; this.saveAccessibility(); this.applyAccessibility(); }
    cycleColorMode(): void { this.colorMode = this.colorModes[(this.colorModes.indexOf(this.colorMode) + 1) % this.colorModes.length]; this.saveAccessibility(); this.applyAccessibility(); }
    private saveAccessibility(): void {
        try { localStorage.setItem('ifrn_a11y_prefs', JSON.stringify({ ...this.a11y, zoom_level: this.zoom, color_mode: this.colorMode })); } catch { /* ignore quota */ }
    }
    private applyAccessibility(): void {
        const body = document.body;
        for (const option of this.accessibilityOptions) body.classList.toggle(option.key, this.a11y[option.key]);
        for (const mode of this.colorModes) body.classList.remove(`color_mode_${mode}`);
        body.classList.add(`color_mode_${this.colorMode}`);
        body.style.setProperty('--font-scale', String(this.zoom / 100));
        if (this.a11y.vlibras_active) this.loadVlibras();
    }
    private loadVlibras(): void {
        if (!document.querySelector('div[vw]')) {
            const widget = document.createElement('div'); widget.setAttribute('vw', ''); widget.className = 'enabled';
            widget.innerHTML = '<div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
            document.body.appendChild(widget);
        }
        if (!document.getElementById('vlibras-script')) {
            const script = document.createElement('script'); script.id = 'vlibras-script'; script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
            script.onload = () => { if (window.VLibras?.Widget) new window.VLibras.Widget('https://vlibras.gov.br/app'); };
            document.body.appendChild(script);
        }
    }
}
