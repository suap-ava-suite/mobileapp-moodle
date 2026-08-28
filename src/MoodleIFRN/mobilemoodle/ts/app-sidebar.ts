/**
 * app-sidebar.ts
 * Sidebar AVA: perfil, acessibilidade, ajuda e filtros.
 */
import { MM, App } from './namespace';


    const FILTER_LABELS: Record<string, string> = {
        inprogress: 'Em andamento',
        allincludinghidden: 'Todos os diários (lento)',
        favourites: 'Favoritos',
        hidden: 'Ocultos',
    };

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

    App.activeFilter = {
        situacao: 'allincludinghidden',
        label: FILTER_LABELS.allincludinghidden,
    };

    function getEl(id: string): HTMLElement | null {
        return document.getElementById(id);
    }

    function setActiveButton(type: SidebarModalType): void {
        document.querySelectorAll('.sidebar-modal-button, .sidebar-user-content-profile').forEach((el) => {
            el.classList.remove('active');
        });

        const btn = getEl(BUTTON_IDS[type]);

        if (btn) {
            btn.classList.add('active');
        }
    }

    function clearActiveButtons(): void {
        document.querySelectorAll('.sidebar-modal-button, .sidebar-user-content-profile').forEach((el) => {
            el.classList.remove('active');
        });
    }

    function closeModal(): void {
        const modal = getEl('sidebar-modal');

        if (modal) {
            modal.hidden = true;
        }

        clearActiveButtons();
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
                App.activeFilter = {
                    situacao: 'allincludinghidden',
                    label: FILTER_LABELS.allincludinghidden,
                };
                updateFilterChip();

                if (select) {
                    select.value = 'allincludinghidden';
                }
            });
        }
    }

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

        body.innerHTML = '';
        body.appendChild(fragment);
        setActiveButton(type);
        modal.hidden = false;

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

    function applyUserFilter(dashboard: DashboardData): void {
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

    function bindSidebar(): void {
        ([
            ['btn-toggle-profile', 'profile'],
            ['btn-toggle-help', 'help'],
            ['btn-toggle-accessibility', 'accessibility'],
            ['btn-toggle-filter', 'filter'],
            ['btn-open-filter-label', 'filter'],
            ['sidebar-active-filters', 'filter'],
        ] as [string, SidebarModalType][]).forEach((pair) => {
            const el = getEl(pair[0]);

            if (!el) {
                return;
            }

            el.addEventListener('click', () => {
                openModal(pair[1]);
            });
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
            if (event.key === 'Escape') {
                closeModal();
            }
        });
    }

    App.closeSidebarModal = closeModal;
    App.openSidebarModal = openModal;
    App.applyUserFilter = applyUserFilter;
    App.updateFilterChip = updateFilterChip;
    App.bindSidebar = bindSidebar;
    App.FILTER_LABELS = FILTER_LABELS;
