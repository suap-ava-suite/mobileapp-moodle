/**
 * app-accessibility.js
 * Preferências de acessibilidade iguais ao theme_ifrn25 (Painel AVA).
 * Persistência local (localStorage) — sem backend do Moodle/SUAP.
 */
(function (window) {
    "use strict";

    const MM = (window.MobileMoodle = window.MobileMoodle || {});
    const App = (MM.App = MM.App || {});

    const STORAGE_KEY = "ifrn_a11y_prefs";

    const BOOL_KEYS = [
        "dyslexia_friendly",
        "remove_justify",
        "highlight_links",
        "stop_animations",
        "hidden_illustrative_image",
        "big_cursor",
        "vlibras_active",
        "high_line_height",
    ];

    const ZOOM_OPTIONS = [100, 120, 130, 150, 160];
    const COLOR_MODE_OPTIONS = ["default", "high_contrast", "low_contrast", "colorblind", "grayscale"];

    const COLOR_MODE_LABELS = {
        default: "Padrão",
        high_contrast: "Alto contraste",
        low_contrast: "Contraste reduzido",
        colorblind: "Amigável a daltônicos",
        grayscale: "Escala de cinza",
    };

    const state = {
        dyslexia_friendly: false,
        remove_justify: false,
        highlight_links: false,
        stop_animations: false,
        hidden_illustrative_image: false,
        big_cursor: false,
        vlibras_active: false,
        high_line_height: false,
        zoom_level: 100,
        color_mode: "default",
    };

    let vlibrasReady = false;

    function $(id) {
        return document.getElementById(id);
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);

            if (!raw) {
                return;
            }

            const saved = JSON.parse(raw);

            BOOL_KEYS.forEach(function (key) {
                if (typeof saved[key] === "boolean") {
                    state[key] = saved[key];
                }
            });

            if (ZOOM_OPTIONS.indexOf(Number(saved.zoom_level)) !== -1) {
                state.zoom_level = Number(saved.zoom_level);
            }

            if (COLOR_MODE_OPTIONS.indexOf(saved.color_mode) !== -1) {
                state.color_mode = saved.color_mode;
            }
        } catch (err) {
            // ignore corrupt storage
        }
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (err) {
            // ignore quota / private mode
        }
    }

    function ensureVlibras() {
        if (vlibrasReady || !state.vlibras_active) {
            return;
        }

        if (!document.querySelector("div[vw]")) {
            const root = document.createElement("div");
            root.setAttribute("vw", "");
            root.className = "enabled";
            root.innerHTML =
                '<div vw-access-button class="active"></div>' +
                '<div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
            document.body.appendChild(root);
        }

        if (window.VLibras && window.VLibras.Widget) {
            try {
                new window.VLibras.Widget("https://vlibras.gov.br/app");
                vlibrasReady = true;
            } catch (err) {
                // widget may already exist
                vlibrasReady = true;
            }
            return;
        }

        if (document.getElementById("vlibras-script")) {
            return;
        }

        const script = document.createElement("script");
        script.id = "vlibras-script";
        script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
        script.onload = function () {
            try {
                new window.VLibras.Widget("https://vlibras.gov.br/app");
                vlibrasReady = true;
            } catch (err) {
                vlibrasReady = true;
            }
        };
        document.body.appendChild(script);
    }

    function applyToBody() {
        const body = document.body;

        BOOL_KEYS.forEach(function (key) {
            body.classList.toggle(key, !!state[key]);
        });

        COLOR_MODE_OPTIONS.forEach(function (mode) {
            body.classList.remove("color_mode_" + mode);
        });

        if (state.color_mode && state.color_mode !== "default") {
            body.classList.add("color_mode_" + state.color_mode);
        } else {
            body.classList.add("color_mode_default");
        }

        if (state.zoom_level && state.zoom_level !== 100) {
            body.setAttribute("data-zoom", String(state.zoom_level));
        } else {
            body.removeAttribute("data-zoom");
        }

        if (state.vlibras_active) {
            ensureVlibras();
        }
    }

    function setBool(key, value) {
        if (BOOL_KEYS.indexOf(key) === -1) {
            return;
        }

        state[key] = !!value;
        saveState();
        applyToBody();
    }

    function cycleZoom() {
        const idx = ZOOM_OPTIONS.indexOf(state.zoom_level);
        const next = ZOOM_OPTIONS[(idx + 1) % ZOOM_OPTIONS.length];

        state.zoom_level = next;
        saveState();
        applyToBody();
        syncPanelControls();
    }

    function cycleColorMode() {
        const idx = COLOR_MODE_OPTIONS.indexOf(state.color_mode);
        const next = COLOR_MODE_OPTIONS[(idx + 1) % COLOR_MODE_OPTIONS.length];

        state.color_mode = next;
        saveState();
        applyToBody();
        syncPanelControls();
    }

    function renderIndicators(container, mode) {
        if (!container) {
            return;
        }

        container.innerHTML = "";

        if (mode === "zoom") {
            ZOOM_OPTIONS.filter(function (level) {
                return level > 100;
            }).forEach(function (level) {
                const span = document.createElement("span");
                span.className = "cycle-indicator" + (level <= state.zoom_level ? " active" : "");
                container.appendChild(span);
            });
            return;
        }

        COLOR_MODE_OPTIONS.filter(function (m) {
            return m !== "default";
        }).forEach(function (m) {
            const span = document.createElement("span");
            span.className = "cycle-indicator" + (m === state.color_mode ? " active" : "");
            container.appendChild(span);
        });
    }

    function syncPanelControls() {
        BOOL_KEYS.forEach(function (key) {
            const el = document.getElementById(key);

            if (el && el.type === "checkbox") {
                el.checked = !!state[key];
            }
        });

        const zoomWrap = $("selector-cycle-access");
        const zoomValue = $("zoom-value");
        const zoomIndicators = $("cycle-indicators");
        const colorWrap = $("selector-cycle-color");
        const colorLabel = $("color-mode-label");
        const colorIndicators = $("color-indicators");

        if (zoomWrap) {
            zoomWrap.classList.toggle("active", state.zoom_level > 100);
        }

        if (zoomValue) {
            zoomValue.textContent = state.zoom_level + "%";
        }

        renderIndicators(zoomIndicators, "zoom");

        if (colorWrap) {
            colorWrap.classList.toggle("active", state.color_mode !== "default");
        }

        if (colorLabel) {
            colorLabel.textContent = COLOR_MODE_LABELS[state.color_mode] || "Padrão";
        }

        renderIndicators(colorIndicators, "color");
    }

    function bindPanelControls() {
        BOOL_KEYS.forEach(function (key) {
            const el = document.getElementById(key);

            if (!el) {
                return;
            }

            el.checked = !!state[key];
            el.addEventListener("change", function () {
                setBool(key, el.checked);
            });
        });

        const zoomBtn = $("cycle-toggle");
        const colorBtn = $("color-mode-toggle");

        if (zoomBtn) {
            zoomBtn.addEventListener("click", function (event) {
                event.preventDefault();
                cycleZoom();
            });
        }

        if (colorBtn) {
            colorBtn.addEventListener("click", function (event) {
                event.preventDefault();
                cycleColorMode();
            });
        }

        syncPanelControls();
    }

    function init() {
        loadState();
        applyToBody();
    }

    App.A11y = {
        init: init,
        bindPanel: bindPanelControls,
        syncPanel: syncPanelControls,
        getState: function () {
            return Object.assign({}, state);
        },
        COLOR_MODE_LABELS: COLOR_MODE_LABELS,
    };
})(window);
