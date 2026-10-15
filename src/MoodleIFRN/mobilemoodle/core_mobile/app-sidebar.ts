/*!
 * app-sidebar.ts
 * ----------------------------------------------------------------------------
 * Cabeçalho IFRN26 + painéis laterais (perfil, ajuda, acessibilidade, filtros).
 *
 * openModal(type) clona o template correspondente (tpl-modal-*) e preenche
 * o painel #sidebar-modal. bindSidebar() liga os botões uma vez no boot.
 */
import { App } from './namespace';


    /** Rótulos exibidos no chip “FILTRADO POR:”. */
    const FILTER_LABELS: Record<string, string> = {
        inprogress: 'Em andamento',
        allincludinghidden: 'Todos os diários',
        favourites: 'Favoritos',
        hidden: 'Ocultos',
    };

    /** Metadados de cada modal: título, ícone e id do <template>. */
    const MODAL_META: Record<SidebarModalType, { title: string; icon: string; tpl: string }> = {
        profile: { title: 'Perfil', icon: 'person-circle-outline', tpl: 'tpl-modal-profile' },
        help: { title: 'Ajuda', icon: 'help-circle-outline', tpl: 'tpl-modal-help' },
        accessibility: { title: 'Acessibilidade', icon: 'accessibility-outline', tpl: 'tpl-modal-accessibility' },
        filter: { title: 'Filtros', icon: 'filter-outline', tpl: 'tpl-modal-filter' },
    };

    const BUTTON_IDS: Record<SidebarModalType, string> = {
        profile: 'btn-toggle-profile',
        help: 'btn-toggle-help',
        accessibility: 'btn-toggle-accessibility',
        filter: 'btn-toggle-filter',
    };

    let userSelectedFilter = false;
    let bound = false;
    let modalTrigger: HTMLElement | null = null;
    const actionSelector = '[aria-controls="sidebar-modal"]';

    App.activeFilter = {
        situacao: 'allincludinghidden',
        label: FILTER_LABELS.allincludinghidden,
    };

    function getEl(id: string): HTMLElement | null {
        return document.getElementById(id);
    }

    function setActiveButton(type: SidebarModalType): void {
        document.querySelectorAll(actionSelector).forEach((el) => {
            el.classList.remove('active');
            el.setAttribute('aria-expanded', 'false');
        });

        const btn = getEl(BUTTON_IDS[type]);

        if (btn) {
            btn.classList.add('active');
            btn.setAttribute('aria-expanded', 'true');
        }
    }

    function clearActiveButtons(): void {
        document.querySelectorAll(actionSelector).forEach((el) => {
            el.classList.remove('active');
            el.setAttribute('aria-expanded', 'false');
        });
    }

    function closeModal(): void {
        const modal = getEl('sidebar-modal');

        if (!modal || modal.hidden) return;
        modal.hidden = true;
        getEl('main-content')?.removeAttribute('inert');
        clearActiveButtons();
        if (modalTrigger?.isConnected) modalTrigger.focus();
        modalTrigger = null;
    }

    function bindAccessibilityControls(): void {
        if (App.A11y?.bindPanel) {
            App.A11y.bindPanel();
        }
    }

    function updateFilterChip(): void {
        const chip = getEl('sidebar-filter-situacao');

        if (chip && App.activeFilter) {
            chip.textContent = App.activeFilter.label;
        }
    }

    function bindFilterControls(): void {
        const select = getEl('filter-situacao') as HTMLSelectElement | null;
        const apply = getEl('filter-apply');
        const clear = getEl('filter-clear');

        const activeFilter = App.activeFilter;

        if (select && activeFilter) {
            select.value = String(activeFilter.situacao);
        }

        if (apply) {
            apply.addEventListener('click', () => {
                const value = select ? select.value : 'allincludinghidden';
                userSelectedFilter = true;

                App.activeFilter = {
                    situacao: value,
                    label: FILTER_LABELS[value] || FILTER_LABELS.allincludinghidden,
                };
                updateFilterChip();
                closeModal();

                if (typeof App.onFilterChange === 'function' && App.activeFilter) {
                    App.onFilterChange(App.activeFilter);
                }
            });
        }

        if (clear) {
            clear.addEventListener('click', () => {
                userSelectedFilter = true;
                App.activeFilter = {
                    situacao: 'allincludinghidden',
                    label: FILTER_LABELS.allincludinghidden,
                };
                updateFilterChip();

                if (select) {
                    select.value = 'allincludinghidden';
                }
                App.onFilterChange?.(App.activeFilter);
            });
        }
    }

    /** Abre o modal lateral e conecta controles específicos (logout, a11y, filtro). */
    function openModal(type: SidebarModalType): void {
        const meta = MODAL_META[type];
        const modal = getEl('sidebar-modal');
        const body = getEl('sidebar-modal-body');
        const title = getEl('sidebar-modal-title');
        const icon = getEl('sidebar-modal-icon') as HTMLElement | null;

        if (!meta || !modal || !body) {
            return;
        }

        const fragment = App.cloneTemplate?.(meta.tpl);

        if (!fragment) {
            return;
        }

        if (title) {
            title.textContent = meta.title;
        }

        if (icon) {
            icon.setAttribute('name', meta.icon);
        }

        if (modal.hidden) modalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        body.innerHTML = '';
        body.appendChild(fragment);
        setActiveButton(type);
        modal.hidden = false;
        getEl('main-content')?.setAttribute('inert', '');
        getEl('sidebar-modal-close')?.focus();

        if (type === 'profile') {
            const nameEl = getEl('modal-profile-name');

            if (nameEl) {
                nameEl.textContent = App.sidebarUserName || 'Estudante';
            }

            const logoutBtn = getEl('modal-logout');

            if (logoutBtn && typeof App.logout === 'function') {
                logoutBtn.addEventListener('click', () => {
                    closeModal();
                    App.logout!();
                });
            }
        }

        if (type === 'accessibility') {
            bindAccessibilityControls();
        }

        if (type === 'filter') {
            bindFilterControls();
        }
    }

    /** Sincroniza o filtro ativo com o que veio do dashboard (API). */
    function applyUserFilter(dashboard: DashboardData): void {
        if (userSelectedFilter) {
            updateFilterChip();
            return;
        }
        const situacao =
            (dashboard && (dashboard.filtro_situacao || dashboard.situacao || dashboard.filter_situacao)) ||
            'allincludinghidden';
        const label =
            (dashboard && (dashboard.filtro_label || dashboard.situacao_label)) ||
            FILTER_LABELS[situacao] ||
            FILTER_LABELS.allincludinghidden;

        App.activeFilter = { situacao, label };
        updateFilterChip();
    }

    /** Liga cliques do menu, avatar do header, fechar (X / backdrop / Esc). */
    function bindSidebar(): void {
        if (bound) return;
        bound = true;
        // Delegação: os filtros são recriados ao renderizar/atualizar o painel.
        const triggers: Record<string, SidebarModalType> = {
            'btn-toggle-profile': 'profile',
            'btn-toggle-help': 'help',
            'btn-toggle-accessibility': 'accessibility',
            'btn-toggle-filter': 'filter',
            'sidebar-active-filters': 'filter',
        };
        document.addEventListener('click', (event) => {
            const button = event.target instanceof Element
                ? event.target.closest<HTMLElement>(actionSelector)
                : null;
            if (button && triggers[button.id]) {
                openModal(triggers[button.id]);
                button.setAttribute('aria-expanded', 'true');
            }
        });

        const closeBtn = getEl('sidebar-modal-close');
        const backdrop = getEl('sidebar-modal-backdrop');

        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        if (backdrop) {
            backdrop.addEventListener('click', closeModal);
        }

        document.addEventListener('keydown', (event: KeyboardEvent) => {
            const modal = getEl('sidebar-modal');
            if (!modal || modal.hidden) return;
            if (event.key === 'Escape') {
                closeModal();
            } else if (event.key === 'Tab') {
                const controls = Array.from(modal.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]',
                )).filter(el => !el.closest('[hidden]') && el.getClientRects().length > 0);
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        });
    }

    App.closeSidebarModal = closeModal;
    App.openSidebarModal = openModal;
    App.applyUserFilter = applyUserFilter;
    App.updateFilterChip = updateFilterChip;
    App.bindSidebar = bindSidebar;
    App.FILTER_LABELS = FILTER_LABELS;
