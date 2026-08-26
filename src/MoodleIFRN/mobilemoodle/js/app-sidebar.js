/**
 * app-sidebar.js
 * Sidebar no estilo theme_ifrn25: perfil, acessibilidade, ajuda e filtros.
 */
(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const App = (MM.App = MM.App || {});

    const FILTER_LABELS = {
        inprogress: "Em andamento",
        allincludinghidden: "Todos os diários (lento)",
        favourites: "Favoritos",
        hidden: "Ocultos",
    };

    const MODAL_META = {
        profile: { title: "Perfil", icon: "person-circle-outline", tpl: "tpl-modal-profile" },
        help: { title: "Ajuda", icon: "help-circle-outline", tpl: "tpl-modal-help" },
        accessibility: { title: "Acessibilidade", icon: "accessibility-outline", tpl: "tpl-modal-accessibility" },
        filter: { title: "Filtros", icon: "filter-outline", tpl: "tpl-modal-filter" },
    };

    const BUTTON_IDS = {
        profile: "btn-toggle-profile",
        help: "btn-toggle-help",
        accessibility: "btn-toggle-accessibility",
        filter: "btn-toggle-filter",
    };

    App.activeFilter = {
        situacao: "allincludinghidden",
        label: FILTER_LABELS.allincludinghidden,
    };

    function $(id) {
        return document.getElementById(id);
    }

    function setActiveButton(type) {
        document.querySelectorAll(".sidebar-modal-button, .sidebar-user-content-profile").forEach(function (el) {
            el.classList.remove("active");
        });

        const btn = $(BUTTON_IDS[type]);

        if (btn) {
            btn.classList.add("active");
        }
    }

    function clearActiveButtons() {
        document.querySelectorAll(".sidebar-modal-button, .sidebar-user-content-profile").forEach(function (el) {
            el.classList.remove("active");
        });
    }

    function closeModal() {
        const modal = $("sidebar-modal");

        if (modal) {
            modal.hidden = true;
        }

        clearActiveButtons();
    }

    function bindAccessibilityControls() {
        if (App.A11y && typeof App.A11y.bindPanel === "function") {
            App.A11y.bindPanel();
        }
    }

    function updateFilterChip() {
        const chip = $("sidebar-filter-situacao");

        if (chip) {
            chip.textContent = App.activeFilter.label;
        }
    }

    function bindFilterControls() {
        const select = $("filter-situacao");
        const apply = $("filter-apply");
        const clear = $("filter-clear");

        if (select) {
            select.value = App.activeFilter.situacao;
        }

        if (apply) {
            apply.addEventListener("click", function () {
                const value = select ? select.value : "allincludinghidden";

                App.activeFilter = {
                    situacao: value,
                    label: FILTER_LABELS[value] || FILTER_LABELS.allincludinghidden,
                };
                updateFilterChip();
                closeModal();

                if (typeof App.onFilterChange === "function") {
                    App.onFilterChange(App.activeFilter);
                }
            });
        }

        if (clear) {
            clear.addEventListener("click", function () {
                App.activeFilter = {
                    situacao: "allincludinghidden",
                    label: FILTER_LABELS.allincludinghidden,
                };
                updateFilterChip();

                if (select) {
                    select.value = "allincludinghidden";
                }
            });
        }
    }

    function openModal(type) {
        const meta = MODAL_META[type];
        const modal = $("sidebar-modal");
        const body = $("sidebar-modal-body");
        const title = $("sidebar-modal-title");
        const icon = $("sidebar-modal-icon");

        if (!meta || !modal || !body) {
            return;
        }

        const fragment = App.cloneTemplate(meta.tpl);

        if (!fragment) {
            return;
        }

        title.textContent = meta.title;
        icon.setAttribute("name", meta.icon);
        body.innerHTML = "";
        body.appendChild(fragment);
        setActiveButton(type);
        modal.hidden = false;

        if (type === "profile") {
            const nameEl = $("modal-profile-name");

            if (nameEl) {
                nameEl.textContent = App.sidebarUserName || "Estudante";
            }

            const logoutBtn = $("modal-logout");

            if (logoutBtn && typeof App.logout === "function") {
                logoutBtn.addEventListener("click", function () {
                    closeModal();
                    App.logout();
                });
            }
        }

        if (type === "accessibility") {
            bindAccessibilityControls();
        }

        if (type === "filter") {
            bindFilterControls();
        }
    }

    /** Situação/filtro do perfil do usuário (quando a API enviar). */
    function applyUserFilter(dashboard) {
        const situacao =
            (dashboard && (dashboard.filtro_situacao || dashboard.situacao || dashboard.filter_situacao)) ||
            "allincludinghidden";
        const label =
            (dashboard && (dashboard.filtro_label || dashboard.situacao_label)) ||
            FILTER_LABELS[situacao] ||
            FILTER_LABELS.allincludinghidden;

        App.activeFilter = { situacao: situacao, label: label };
        updateFilterChip();
    }

    function bindSidebar() {
        [
            ["btn-toggle-profile", "profile"],
            ["btn-toggle-help", "help"],
            ["btn-toggle-accessibility", "accessibility"],
            ["btn-toggle-filter", "filter"],
            ["btn-open-filter-label", "filter"],
            ["sidebar-active-filters", "filter"],
        ].forEach(function (pair) {
            const el = $(pair[0]);

            if (!el) {
                return;
            }

            el.addEventListener("click", function () {
                openModal(pair[1]);
            });
        });

        const closeBtn = $("sidebar-modal-close");
        const backdrop = $("sidebar-modal-backdrop");

        if (closeBtn) {
            closeBtn.addEventListener("click", closeModal);
        }

        if (backdrop) {
            backdrop.addEventListener("click", closeModal);
        }

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
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
})(window);
