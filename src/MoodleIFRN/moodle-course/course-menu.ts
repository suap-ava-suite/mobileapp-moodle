import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CoreSharedModule } from '@/core/shared.module';
import { ContextLevel } from '@/core/constants';
import { CoreSites } from '@services/sites';
import { CoreNavigator } from '@services/navigator';
import { CoreModals } from '@services/overlays/modals';
import { CoreAlerts } from '@services/overlays/alerts';
import { AddonMessages } from '@addons/messages/services/messages';
import { ADDON_MESSAGES_PAGE_NAME, ADDONS_MESSAGES_MENU_FEATURE_NAME } from '@addons/messages/constants';
import { ADDONS_NOTIFICATIONS_MAIN_PAGE_NAME, ADDONS_NOTIFICATIONS_MENU_FEATURE_NAME } from '@addons/notifications/constants';
import type { CoreCourseFormatComponent } from '@features/course/components/course-format/course-format';
import {
    IfrnCourseAccessibilityService,
    IfrnA11yBoolKey,
} from './course-accessibility';

type CourseMenuAction = 'index' | 'blocks' | 'notifications' | 'messages' | 'accessibility';

interface A11yToggle {
    key: IfrnA11yBoolKey;
    label: string;
    icon: string;
    hint: string;
}

/** Atalhos do ambiente atual; conteúdos e permissões continuam sob controle do Moodle. */
@Component({
    selector: 'ifrn-course-menu',
    standalone: true,
    imports: [CoreSharedModule],
    templateUrl: './course-menu.html',
    styleUrls: ['./course-menu.scss'],
})
export class IfrnCourseMenuComponent implements OnChanges, OnDestroy {

    @Input() courseId = 0;
    @Input() format?: CoreCourseFormatComponent;

    menuOpen = false;
    a11yOpen = false;
    busy = false;
    checkingMessages = false;
    messagesEnabled = false;
    notificationsEnabled = false;
    environment = '';

    readonly a11yToggles: A11yToggle[] = [
        {
            key: 'dyslexia_friendly',
            label: 'Fonte amigável a disléxicos',
            icon: 'fas-font',
            hint: 'Usa OpenDyslexic para leitura mais clara.',
        },
        {
            key: 'highlight_links',
            label: 'Destacar links',
            icon: 'fas-link',
            hint: 'Deixa os links mais evidentes na página.',
        },
        {
            key: 'stop_animations',
            label: 'Parar animações',
            icon: 'fas-pause',
            hint: 'Reduz movimento e transições.',
        },
        {
            key: 'hidden_illustrative_image',
            label: 'Ocultar imagens ilustrativas',
            icon: 'fas-image',
            hint: 'Esconde imagens decorativas sem texto alternativo.',
        },
        {
            key: 'big_cursor',
            label: 'Cursor do mouse grande',
            icon: 'fas-hand-pointer',
            hint: 'Aumenta o cursor quando disponível.',
        },
        {
            key: 'vlibras_active',
            label: 'Habilitar VLibras',
            icon: 'fas-hands-asl-interpreting',
            hint: 'Widget oficial de Libras (vlibras.gov.br).',
        },
        {
            key: 'high_line_height',
            label: 'Linhas mais distantes',
            icon: 'fas-align-left',
            hint: 'Aumenta o espaçamento entre linhas.',
        },
    ];

    private siteId = '';
    private openedCourseId = 0;
    private generation = 0;
    private destroyed = false;
    private pendingAction?: CourseMenuAction;

    constructor(readonly a11y: IfrnCourseAccessibilityService) {}

    get visible(): boolean {
        try {
            const site = CoreSites.getCurrentSite();
            const host = new URL(site?.getURL() || '').hostname;

            return !!site && !site.isLoggedOut() && Number.isSafeInteger(this.courseId) && this.courseId > 0
                && (host === 'ava.ifrn.edu.br' || host.endsWith('.ava.ifrn.edu.br'));
        } catch {
            return false;
        }
    }

    get indexEnabled(): boolean {
        return !!this.format?.loaded && !!this.format.displayCourseIndex;
    }

    get blocksEnabled(): boolean {
        return !!this.format?.loaded && !!this.format.displayBlocks && !!this.format.hasBlocks;
    }

    get zoomLabel(): string {
        return `${this.a11y.zoomLevel}%`;
    }

    get colorModeLabel(): string {
        return this.a11y.colorModeLabel;
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['courseId'] && this.visible) {
            this.a11y.init();
        }
    }

    async openMenu(): Promise<void> {
        if (!this.visible || this.busy || this.menuOpen || this.destroyed) {
            return;
        }
        const site = CoreSites.getCurrentSite();
        if (!site) {
            return;
        }
        this.siteId = site.getId();
        this.openedCourseId = this.courseId;
        this.environment = new URL(site.getURL()).hostname;
        this.pendingAction = undefined;
        this.messagesEnabled = false;
        this.notificationsEnabled = !site.isFeatureDisabled(ADDONS_NOTIFICATIONS_MENU_FEATURE_NAME);
        this.checkingMessages = true;
        this.menuOpen = true;
        const generation = ++this.generation;
        try {
            const enabled = !site.isFeatureDisabled(ADDONS_MESSAGES_MENU_FEATURE_NAME)
                && await AddonMessages.isPluginEnabled(this.siteId);
            if (generation === this.generation && this.sameContext()) {
                this.messagesEnabled = enabled;
            }
        } catch {
            // Sem suporte ou falha na consulta: não oferece um atalho inválido.
            if (generation === this.generation) {
                this.messagesEnabled = false;
            }
        } finally {
            if (generation === this.generation) {
                this.checkingMessages = false;
            }
        }
    }

    choose(action: CourseMenuAction): void {
        if (this.busy || !this.menuOpen || !this.sameContext() || !this.enabled(action)) {
            return;
        }
        this.busy = true;
        this.pendingAction = action;
        this.menuOpen = false;
    }

    closeMenu(): void {
        this.pendingAction = undefined;
        this.menuOpen = false;
    }

    closeA11y(): void {
        this.a11yOpen = false;
    }

    toggleA11y(key: IfrnA11yBoolKey, checked: boolean): void {
        this.a11y.setBool(key, checked);
    }

    cycleZoom(): void {
        this.a11y.cycleZoom();
    }

    cycleColorMode(): void {
        this.a11y.cycleColorMode();
    }

    /** Espera o modal fechar antes de abrir outro modal ou navegar. */
    async menuDismissed(): Promise<void> {
        this.menuOpen = false;
        ++this.generation;
        const action = this.pendingAction;
        this.pendingAction = undefined;
        try {
            if (!action || !this.sameContext() || !this.enabled(action)) {
                return;
            }
            if (action === 'accessibility') {
                this.a11y.init();
                this.a11yOpen = true;

                return;
            }
            if (action === 'index') {
                await this.format?.openCourseIndex();
            } else if (action === 'blocks') {
                const { CoreBlockSideBlocksComponent } = await import('@features/block/components/side-blocks/side-blocks');
                if (!this.sameContext() || !this.blocksEnabled) {
                    return;
                }
                await CoreModals.openSideModal({
                    component: CoreBlockSideBlocksComponent,
                    componentProps: { contextLevel: ContextLevel.COURSE, instanceId: this.courseId },
                });
            } else {
                const path = action === 'messages' ? ADDON_MESSAGES_PAGE_NAME
                    : ADDONS_NOTIFICATIONS_MAIN_PAGE_NAME;
                // Mantém a pilha do curso e o site atual, para o botão Voltar funcionar.
                const navigated = await CoreNavigator.navigateToSitePath(path, {
                    siteId: this.siteId, preferCurrentTab: true,
                });
                if (!navigated) {
                    throw new Error('Não foi possível abrir esta opção. Tente novamente.');
                }
            }
        } catch (error) {
            if (!this.destroyed && CoreSites.getCurrentSiteId() === this.siteId) {
                await CoreAlerts.showError(error);
            }
        } finally {
            this.busy = false;
        }
    }

    a11yDismissed(): void {
        this.a11yOpen = false;
        this.busy = false;
    }

    ngOnDestroy(): void {
        this.destroyed = true;
        ++this.generation;
        this.pendingAction = undefined;
        this.menuOpen = false;
        this.a11yOpen = false;
    }

    private sameContext(): boolean {
        const path = CoreNavigator.getCurrentPath().split(/[?#]/)[0];
        const currentCourseId = Number(path.match(/\/course(?:\/deep)*\/(\d+)(?:\/|$)/)?.[1]);

        return !this.destroyed && this.visible && CoreSites.getCurrentSiteId() === this.siteId
            && this.courseId === this.openedCourseId && currentCourseId === this.courseId;
    }

    private enabled(action: CourseMenuAction): boolean {
        const site = CoreSites.getCurrentSite();
        switch (action) {
            case 'index': return this.indexEnabled;
            case 'blocks': return this.blocksEnabled;
            case 'messages': return this.messagesEnabled && !this.checkingMessages
                && !!site && !site.isFeatureDisabled(ADDONS_MESSAGES_MENU_FEATURE_NAME);
            case 'notifications': return this.notificationsEnabled
                && !!site && !site.isFeatureDisabled(ADDONS_NOTIFICATIONS_MENU_FEATURE_NAME);
            case 'accessibility': return true;
        }
    }

}
