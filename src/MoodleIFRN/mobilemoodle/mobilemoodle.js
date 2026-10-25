(() => {
        const base = new URL('static/theme/ifrn/', document.currentScript.src).href;
        const style = document.createElement('style');
        style.id = 'ifrn-panel-theme';
        style.textContent = "@font-face {\n  font-family: \"Rawline\";\n  src: url(\"__IFRN_THEME_BASE__fonts/rawline-400.woff2\") format(\"woff2\");\n  font-style: normal;\n  font-weight: 400;\n  font-display: swap;\n}\n@font-face {\n  font-family: \"Rawline\";\n  src: url(\"__IFRN_THEME_BASE__fonts/rawline-500.woff2\") format(\"woff2\");\n  font-style: normal;\n  font-weight: 500;\n  font-display: swap;\n}\n@font-face {\n  font-family: \"Rawline\";\n  src: url(\"__IFRN_THEME_BASE__fonts/rawline-600.woff2\") format(\"woff2\");\n  font-style: normal;\n  font-weight: 600;\n  font-display: swap;\n}\n@font-face {\n  font-family: \"Rawline\";\n  src: url(\"__IFRN_THEME_BASE__fonts/rawline-700.woff2\") format(\"woff2\");\n  font-style: normal;\n  font-weight: 700;\n  font-display: swap;\n}\n:root.dark {\n  --dsgov-bg-white: #282828;\n  --dsgov-bg-gray: #282828;\n  --dsgov-bg-light-gray: #282828;\n  --dsgov-bg-gray-hover: #343a40;\n  --dsgov-bg-hover: #343a40;\n  --dsgov-bg-blue-light: #162438;\n  --dsgov-text-darkest: #ffffff;\n  --dsgov-text-dark: #ffffff;\n  --dsgov-text-secondary: #dee2e6;\n  --dsgov-text-medium: #ced4da;\n  --dsgov-text-muted: #ced4da;\n  --dsgov-blue-70: #82b1ff;\n  --dsgov-blue-80: #b3d1ff;\n  --dsgov-blue-90: #c5d6f5;\n  --dsgov-blue-10: #162438;\n  --dsgov-border-outer: #495057;\n  --dsgov-border-inner: #343a40;\n  --dsgov-border-default: #495057;\n  color-scheme: dark;\n}\n\n:root {\n  --dsgov-blue-90: #071d41;\n  --dsgov-blue-80: #0c326f;\n  --dsgov-blue-70: #1351b4;\n  --dsgov-blue-60: #155bcb;\n  --dsgov-blue-20: #c5d6f5;\n  --dsgov-blue-10: #eaeff8;\n  --dsgov-blue-darkest: #04122b;\n  --dsgov-green-60: #2d8a45;\n  --dsgov-green-hover: #184f16;\n  --dsgov-green-badge-bg: #d4f0d8;\n  --dsgov-yellow-30: #DDAA01;\n  --dsgov-yellow-20: #FFCD07;\n  --dsgov-error: #d93514;\n  --dsgov-error-hover: #a8250b;\n  --dsgov-blue-badge-bg: #d9e7ff;\n  --dsgov-text-darkest: #000000;\n  --dsgov-text-dark: #333333;\n  --dsgov-text-secondary: #444444;\n  --dsgov-text-medium: #555555;\n  --dsgov-text-muted: #666666;\n  --dsgov-text-light: #ffffff;\n  --dsgov-bg-white: #ffffff;\n  --dsgov-bg-gray: #f6f6f6;\n  --dsgov-bg-gray-hover: #eeeeee;\n  --dsgov-bg-light-gray: #f7f9fa;\n  --dsgov-bg-hover: #f0f2f5;\n  --dsgov-bg-blue-light: #f0f5ff;\n  --dsgov-bg-disabled: #e6e6e6;\n  --dsgov-bg-progress-track: #e0e0e0;\n  --dsgov-bg-progress-zero: #c4c4c4;\n  --dsgov-border-outer: #cccccc;\n  --dsgov-border-inner: #e6e6e6;\n  --dsgov-border-light: #e5e5e5;\n  --dsgov-border-divider: #dddddd;\n  --dsgov-border-default: #cccccc;\n  --dsgov-border-medium: #9e9e9e;\n  --dsgov-border-heavy: #676767;\n  --dsgov-shadow-header: 0 2px 8px rgba(0, 0, 0, 0.2);\n  --dsgov-shadow-popover: 0 8px 24px rgba(0, 0, 0, 0.15);\n  --dsgov-shadow-card: 0 4px 16px rgba(0, 0, 0, 0.04);\n  --dsgov-shadow-login-card: 0 4px 16px rgba(0, 0, 0, 0.08);\n  --dsgov-shadow-dropdown: 0 5px 15px rgba(0, 0, 0, 0.1);\n  --dsgov-focus-ring-blue: 0 0 0 3px rgba(19, 81, 180, 0.35);\n  --dsgov-focus-ring-error: 0 0 0 3px rgba(217, 53, 20, 0.25);\n  --dsgov-font-family: Rawline, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif;\n  --dsgov-header-height: 80px;\n  --dsgov-tab-nav-height: 50px;\n  --dsgov-container-max-width: 1200px;\n  --dsgov-login-card-max-width: 600px;\n  --dsgov-radius-none: 0;\n  --dsgov-radius-default: 4px;\n  --dsgov-radius-sm: 8px;\n  --dsgov-radius-md: 12px;\n  --dsgov-radius-pill-sm: 20px;\n  --dsgov-radius-pill: 24px;\n  --dsgov-radius-pill-lg: 28px;\n  --dsgov-radius-circle: 50%;\n  --dsgov-spacing-xs: 4px;\n  --dsgov-spacing-sm: 8px;\n  --dsgov-spacing-md: 16px;\n  --dsgov-spacing-lg: 24px;\n  --dsgov-spacing-xl: 32px;\n  --dsgov-spacing-2xl: 40px;\n  --dsgov-font-size-xs: 0.75rem;\n  --dsgov-font-size-sm: 0.85rem;\n  --dsgov-font-size-base: 0.95rem;\n  --dsgov-font-size-md: 1rem;\n  --dsgov-font-size-lg: 1.15rem;\n  --dsgov-font-size-xl: 1.35rem;\n  --dsgov-font-size-2xl: 1.5rem;\n  --dsgov-font-weight-normal: 400;\n  --dsgov-font-weight-medium: 500;\n  --dsgov-font-weight-semibold: 600;\n  --dsgov-font-weight-bold: 700;\n  --dsgov-transition-fast: 0.15s ease;\n  --dsgov-transition-base: 0.2s ease;\n  --gov-primary: var(--dsgov-blue-70);\n  --gov-primary-dark: var(--dsgov-blue-90);\n  --gov-primary-light: var(--dsgov-blue-10);\n  --gov-success: var(--dsgov-green-60);\n  --gov-error: var(--dsgov-error);\n  --gov-surface: var(--dsgov-bg-white);\n  --gov-page-bg: var(--dsgov-bg-gray);\n}\n\n:root {\n  --page-max-width: var(--dsgov-container-max-width);\n  --vermelho-primario: var(--dsgov-error);\n  --verde-tema: var(--dsgov-blue-70);\n  --verde-terciario: var(--dsgov-green-badge-bg);\n  --verde-primario: var(--dsgov-green-60);\n  --verde-secundario: var(--dsgov-green-hover);\n  --verde-botao: var(--dsgov-green-60);\n  --verde-escuro: var(--dsgov-blue-90);\n  --verde-claro: var(--dsgov-blue-10);\n  --verde-icon: var(--dsgov-blue-70);\n  --azul-primario: var(--dsgov-blue-70);\n  --escuro-primario: var(--dsgov-text-dark);\n  --cinza-primario: var(--dsgov-border-outer);\n  --cinza-secundario: var(--dsgov-text-secondary);\n  --cinza-terciario: var(--dsgov-border-inner);\n  --branco-primario: var(--dsgov-bg-white);\n  --branco-secundario: var(--dsgov-bg-light-gray);\n  --background-color: var(--dsgov-bg-gray);\n  --unnamed-color-1d2125: var(--dsgov-blue-darkest);\n  --primary: var(--dsgov-blue-70);\n  --primary-dark: var(--dsgov-blue-80);\n  --primary-light: var(--dsgov-blue-10);\n  --secondary: var(--dsgov-blue-60);\n  --secondary-dark: var(--dsgov-blue-80);\n  --secondary-light: var(--dsgov-blue-badge-bg);\n  --success: var(--dsgov-green-60);\n  --success-dark: var(--dsgov-green-hover);\n  --success-light: var(--dsgov-green-badge-bg);\n  --danger: var(--dsgov-error);\n  --danger-dark: var(--dsgov-error-hover);\n  --danger-light: #fdecea;\n  --warning: var(--dsgov-yellow-20);\n  --warning-dark: var(--dsgov-yellow-30);\n  --warning-light: #fff9e6;\n  --info: var(--dsgov-blue-60);\n  --info-dark: var(--dsgov-blue-90);\n  --info-light: var(--dsgov-blue-10);\n  --light: var(--dsgov-border-inner);\n  --light-dark: var(--dsgov-border-default);\n  --light-lighter: var(--dsgov-bg-gray);\n  --dark: var(--dsgov-text-dark);\n  --dark-darker: var(--dsgov-blue-darkest);\n  --dark-light: var(--dsgov-text-muted);\n  --muted: var(--dsgov-text-muted);\n  --general-white: var(--dsgov-bg-white);\n  --bg-green: var(--dsgov-bg-light-gray);\n  --bg-green-gradient: linear-gradient(131.57deg, var(--dsgov-blue-10) 7.49%, var(--dsgov-bg-white) 84.71%);\n  --counter-close: 56px;\n  --counter-default: 252px;\n  --drawer-open: 294px;\n  --max-width-layout: 894px;\n  --max-width-layout-expanded: 1180px;\n  --shadow-primary: var(--dsgov-shadow-card);\n  --ion-color-primary: var(--dsgov-blue-70);\n  --ion-color-primary-rgb: 19, 81, 180;\n  --ion-color-primary-contrast: var(--dsgov-text-light);\n  --ion-color-primary-contrast-rgb: 255, 255, 255;\n  --ion-color-primary-shade: var(--dsgov-blue-80);\n  --ion-color-primary-tint: var(--dsgov-blue-60);\n  --ion-color-secondary: var(--dsgov-blue-60);\n  --ion-color-secondary-rgb: 21, 91, 203;\n  --ion-color-secondary-contrast: var(--dsgov-text-light);\n  --ion-color-secondary-shade: var(--dsgov-blue-80);\n  --ion-color-secondary-tint: var(--dsgov-blue-60);\n  --ion-font-family: var(--dsgov-font-family);\n  --ion-background-color: var(--dsgov-bg-white);\n  --ion-text-color: var(--dsgov-text-dark);\n}\n\nbody {\n  --font-family: var(--dsgov-font-family);\n  --font-scale: 1;\n  --font-heading1: 700 calc(1.5rem * var(--font-scale)) / normal var(--font-family);\n  --font-heading2: 700 calc(1.125rem * var(--font-scale)) / normal var(--font-family);\n  --font-heading3: 500 calc(1rem * var(--font-scale)) / normal var(--font-family);\n  --font-heading4: 500 calc(0.875rem * var(--font-scale)) / normal var(--font-family);\n  --font-heading5: 500 calc(0.75rem * var(--font-scale)) / normal var(--font-family);\n  --font-heading6: 500 calc(0.625rem * var(--font-scale)) / normal var(--font-family);\n  --font-heading7: 700 calc(2.375rem * var(--font-scale)) / normal var(--font-family);\n  --font-button1: 600 calc(1rem * var(--font-scale)) / normal var(--font-family);\n  --font-button2: 600 calc(0.875rem * var(--font-scale)) / normal var(--font-family);\n  --font-button3: 600 calc(0.75rem * var(--font-scale)) / normal var(--font-family);\n  --font-paragraph1: 400 calc(1rem * var(--font-scale)) / 1.5 var(--font-family);\n  --font-paragraph2: 400 calc(0.875rem * var(--font-scale)) / 1.5 var(--font-family);\n}\n\n:root.dark {\n  --ion-color-primary-rgb: 130, 177, 255;\n  --ion-color-primary-contrast: #04122b;\n  --ion-color-primary-contrast-rgb: 4, 18, 43;\n  --ion-background-color: var(--dsgov-bg-white);\n  --ion-text-color: var(--dsgov-text-dark);\n  --ion-item-background: var(--dsgov-bg-white);\n}\n\n:root {\n  --keyboard-height: 0px;\n  --ion-safe-area-top: env(safe-area-inset-top, 0px);\n  --ion-safe-area-right: 0px;\n  --ion-safe-area-bottom: 0px;\n  --ion-safe-area-left: 0px;\n  --safe-area-top: env(safe-area-inset-top, 0px);\n  --safe-area-right: env(safe-area-inset-right, 0px);\n  --safe-area-bottom: env(safe-area-inset-bottom, 0px);\n  --safe-area-left: env(safe-area-inset-left, 0px);\n}\n\nhtml,\nbody {\n  height: 100%;\n  margin: 0;\n  font: var(--font-paragraph1);\n  color: var(--escuro-primario);\n  background: var(--branco-secundario);\n  overflow-x: hidden;\n  -webkit-text-size-adjust: 100%;\n  text-size-adjust: 100%;\n}\n\nion-app {\n  height: calc(100% - var(--keyboard-height, 0px));\n  max-width: 100vw;\n}\n\n* {\n  box-sizing: border-box;\n}\n\n:root {\n  --ifrn-safe-area-top: var(--ion-safe-area-top);\n}\n\n.ava-header {\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);\n}\n\n.ava-toolbar {\n  --background: #fff;\n  --color: var(--primary-dark);\n  --border-width: 0;\n  --min-height: 72px;\n  --padding-top: 0;\n  --padding-bottom: 0;\n  --padding-start: 0;\n  --padding-end: 0;\n}\n\n.ava-toolbar-inner {\n  display: flex;\n  align-items: center;\n  gap: 16px;\n  min-height: 72px;\n  max-width: 1200px;\n  margin: auto;\n  padding: 8px 24px;\n}\n\n.ava-header-logo {\n  width: auto;\n  height: 36px;\n  flex-shrink: 0;\n  object-fit: contain;\n}\n\n.ava-header-brand {\n  flex: 1;\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.ava-header-title {\n  font-size: 1.25rem;\n  font-weight: 700;\n  color: var(--primary-dark);\n}\n\n.ava-header-subtitle {\n  font-size: 0.75rem;\n  color: var(--muted);\n}\n\n.ava-header-title, .ava-header-subtitle {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ava-header-actions {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  flex-shrink: 0;\n}\n\n.ava-header-action {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n  min-width: 44px;\n  min-height: 44px;\n  padding: 6px;\n  background: transparent;\n  color: var(--primary);\n  border: 0;\n  border-radius: 999px;\n  font: inherit;\n  cursor: pointer;\n}\n\n.ava-header-action ion-icon {\n  font-size: 24px;\n}\n\n.ava-header-action:hover, .ava-header-action.active {\n  background: var(--primary-light);\n}\n\n.ava-header-profile span {\n  max-width: 160px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 0.875rem;\n}\n\n.profile-image {\n  width: 32px;\n  height: 32px;\n  border-radius: 50%;\n  object-fit: cover;\n  flex-shrink: 0;\n}\n\n.profile-image--initials {\n  display: grid;\n  place-items: center;\n  font-size: 0.875rem;\n  font-weight: 700;\n  background: var(--primary-light);\n  color: var(--primary-dark);\n}\n\nbutton:focus-visible, a:focus-visible, select:focus-visible {\n  outline: 2px solid var(--primary);\n  outline-offset: 3px;\n}\n\n.page-error,\n.empty-state,\n.no-data {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 12px;\n  min-height: 40vh;\n  padding: 24px;\n  text-align: center;\n  color: var(--muted);\n}\n\n.no-data {\n  margin-top: 2rem;\n  max-width: 1360px;\n  margin-inline: auto;\n}\n\n.no-data h3,\n.page-error h3,\n.empty-state h3 {\n  margin: 0;\n  font: var(--font-heading2);\n  color: var(--dark);\n}\n\n.page-intro {\n  padding: 8px 4px 16px;\n}\n\n.page-intro h2 {\n  margin: 0 0 4px;\n  font: var(--font-heading2);\n}\n\n.page-intro p {\n  margin: 0;\n  color: var(--cinza-secundario);\n  font-size: 0.9375rem;\n}\n\n.painel-page,\n.curso-page {\n  padding: 8px 16px 32px;\n  max-width: 1200px;\n  margin-inline: auto;\n  overflow-x: hidden;\n}\n\nion-content#page-content {\n  --padding-bottom: max(env(safe-area-inset-bottom), var(--ion-safe-area-bottom, 0px));\n}\n\nbody.keyboard-is-open ion-content#page-content {\n  --keyboard-offset: var(--keyboard-height, 0px);\n  --padding-bottom: max(12px, var(--keyboard-height, 0px));\n}\n\nbody.keyboard-is-open .sidebar-modal__panel {\n  max-height: calc(100dvh - var(--keyboard-height, 0px));\n}\n\nbody.keyboard-is-open .sidebar-modal__body {\n  overflow-y: auto;\n  -webkit-overflow-scrolling: touch;\n}\n\n#main-content ion-header ion-toolbar {\n  --background: var(--branco-primario);\n  --color: var(--dark);\n  --border-width: 0;\n}\n\n#main-content .ava-header-title {\n  color: var(--dark);\n}\n\n.sidebar-modal {\n  position: fixed;\n  inset: 0;\n  z-index: 10000;\n  display: flex;\n  justify-content: flex-end;\n}\n\n.sidebar-modal[hidden] {\n  display: none !important;\n}\n\n.sidebar-modal__backdrop {\n  position: absolute;\n  inset: 0;\n  background: rgba(0, 0, 0, 0.35);\n}\n\n.sidebar-modal__panel {\n  position: relative;\n  z-index: 1;\n  width: min(400px, 100vw);\n  height: 100%;\n  background: var(--dsgov-bg-white);\n  box-shadow: var(--dsgov-shadow-popover);\n  display: flex;\n  flex-direction: column;\n  animation: sidebar-modal-in 0.3s cubic-bezier(0.2, 0, 0, 1);\n}\n\n@keyframes sidebar-modal-in {\n  from {\n    transform: translateX(100%);\n    opacity: 0.6;\n  }\n  to {\n    transform: translateX(0);\n    opacity: 1;\n  }\n}\n.sidebar-modal__header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 16px;\n  padding-top: calc(16px + max(32px, var(--ifrn-safe-area-top, 0px), var(--ion-safe-area-top, 0px), var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px)));\n  padding-left: max(16px, env(safe-area-inset-left, 0px));\n  padding-right: max(16px, env(safe-area-inset-right, 0px));\n  flex-shrink: 0;\n  border-bottom: 1px solid var(--light);\n  background: var(--dsgov-bg-white);\n  color: var(--primary-dark);\n}\n\n.sidebar-modal__header-title {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font: var(--font-heading2);\n  min-width: 0;\n}\n\n.sidebar-modal__header-title ion-icon {\n  font-size: 20px;\n  flex-shrink: 0;\n}\n\n.sidebar-modal__header-title span {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.sidebar-modal__close {\n  box-sizing: border-box;\n  width: 44px;\n  height: 44px;\n  border: 0;\n  border-radius: 50%;\n  background: var(--primary-light);\n  color: var(--primary);\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  padding: 0;\n  margin: 0;\n  line-height: 0;\n  flex-shrink: 0;\n}\n\n.sidebar-modal__close ion-icon {\n  display: block;\n  font-size: 20px;\n  width: 20px;\n  height: 20px;\n  color: inherit;\n  pointer-events: none;\n}\n\n.sidebar-modal__body {\n  flex: 1;\n  overflow-y: auto;\n  padding: 16px;\n}\n\n.ava-modal-body {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n\n.ava-modal-body__user {\n  margin: 0 0 8px;\n  font: var(--font-heading2);\n  color: var(--dark);\n  padding: 12px 14px;\n  border: 1px solid var(--light);\n  border-radius: 4px;\n  background: var(--light-lighter);\n}\n\n.ava-button-options {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.ava-modal-body__hint {\n  margin: 0 0 8px;\n  color: var(--muted);\n  font-size: 0.875rem;\n}\n\n.modal-content-body-title {\n  display: block;\n  margin: 8px 0 4px;\n  font: var(--font-heading5);\n  color: var(--muted);\n  text-transform: uppercase;\n  letter-spacing: 0.04em;\n}\n\n.modal-button-option,\n.modal-content-body-help-link {\n  display: block;\n  padding: 12px 14px;\n  color: var(--primary-dark);\n  text-decoration: none;\n  font: var(--font-button2);\n  width: 100%;\n  text-align: left;\n  cursor: pointer;\n  border: 1px solid var(--light);\n  border-radius: 4px;\n  background: var(--light-lighter);\n}\n\n.modal-button-option.exit-button {\n  margin-top: 16px;\n  background: var(--danger-light);\n  color: var(--danger-dark);\n  border-color: rgba(220, 3, 15, 0.25);\n}\n\n.modal-content-body-help-options {\n  margin-top: 8px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.filter-select-area {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 10px 12px;\n  border: 1px solid var(--light);\n  border-radius: 4px;\n  background: var(--light-lighter);\n}\n\n.filter-select-area ion-icon {\n  color: var(--primary);\n  font-size: 18px;\n  flex-shrink: 0;\n}\n\n.filter-select-area select {\n  flex: 1;\n  border: none;\n  background: transparent;\n  font: var(--font-paragraph1);\n  color: var(--dark);\n  min-width: 0;\n}\n\n.modal-content-body-filter-button {\n  margin-top: 8px;\n  width: 100%;\n  border: none;\n  border-radius: 10px;\n  padding: 12px;\n  background: var(--primary);\n  color: var(--dsgov-text-light);\n  font: var(--font-button2);\n  cursor: pointer;\n}\n\n.modal-content-body-filter-clear {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n  width: 100%;\n  border: none;\n  background: transparent;\n  color: var(--danger-dark);\n  font: var(--font-button2);\n  cursor: pointer;\n  padding: 10px;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .sidebar-modal__panel {\n    animation: none;\n  }\n}\n@font-face {\n  font-family: \"opendyslexic\";\n  src: url(\"https://ava-painel-statics.pages.dev/vendors/OpenDyslexic/OpenDyslexic-Regular.otf\") format(\"opentype\");\n  font-style: normal;\n  font-weight: normal;\n}\n@font-face {\n  font-family: \"opendyslexic\";\n  src: url(\"https://ava-painel-statics.pages.dev/vendors/OpenDyslexic/OpenDyslexic-Italic.woff2\") format(\"opentype\");\n  font-style: italic;\n  font-weight: normal;\n}\n@font-face {\n  font-family: \"opendyslexic\";\n  src: url(\"https://ava-painel-statics.pages.dev/vendors/OpenDyslexic/OpenDyslexic-Bold.otf\") format(\"opentype\");\n  font-weight: bold;\n  font-style: normal;\n}\n@font-face {\n  font-family: \"opendyslexic\";\n  src: url(\"https://ava-painel-statics.pages.dev/vendors/OpenDyslexic/OpenDyslexic-Bold-Italic.otf\") format(\"opentype\");\n  font-weight: bold;\n  font-style: italic;\n}\n.accessiblity-options {\n  display: flex;\n  flex-direction: column;\n  gap: 0.75rem;\n}\n\n.custom-checkbox-access {\n  font: var(--font-button2);\n}\n\n.checkbox-access-label {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  flex-wrap: nowrap;\n  gap: 0.5rem;\n  border: 1px solid transparent;\n  border-radius: 72px;\n  background-color: var(--light);\n  padding: 0.75rem 1rem;\n  width: 100%;\n  cursor: pointer;\n  transition: all 0.2s ease-in-out;\n  color: var(--dark);\n}\n\n.checkbox-access-label:hover {\n  border-color: var(--primary);\n}\n\n.checkbox-access-label .label-container {\n  display: flex;\n  align-items: center;\n  gap: 0.35rem;\n  min-width: 0;\n}\n\n.checkbox-access-label .icon-id {\n  color: var(--dark);\n  flex-shrink: 0;\n  width: 16px;\n  height: 16px;\n  font-size: 16px;\n}\n\n.checkbox-access-label .icon-checked {\n  display: none;\n  color: var(--primary);\n  font-size: 18px;\n  flex-shrink: 0;\n}\n\n.checkbox-access-input {\n  position: absolute;\n  opacity: 0;\n  width: 0;\n  height: 0;\n}\n\n.checkbox-access-input:checked + .checkbox-access-label {\n  color: var(--primary);\n  border-color: var(--primary);\n  box-shadow: 0 0 0 2px var(--primary-light);\n}\n\n.checkbox-access-input:checked + .checkbox-access-label .icon-checked {\n  display: block;\n}\n\n.checkbox-access-input:focus-visible + .checkbox-access-label {\n  outline: 2px solid var(--primary);\n  outline-offset: 2px;\n}\n\n.selector-cycle-access {\n  font: var(--font-button2);\n}\n\n.selector-cycle-access > label {\n  display: block;\n  margin-bottom: 0.35rem;\n  color: var(--dark);\n}\n\n.selector-cycle-access.active .cycle-btn {\n  color: var(--primary);\n  border-color: var(--primary);\n  box-shadow: 0 0 0 2px var(--primary-light);\n}\n\n.selector-cycle-access .cycle-btn {\n  display: block;\n  background-color: var(--light);\n  border: 1px solid transparent;\n  border-radius: 72px;\n  padding: 0.75rem 1rem;\n  width: 100%;\n  font: var(--font-button2);\n  color: var(--dark);\n  text-align: left;\n  cursor: pointer;\n  transition: all 0.2s ease-in-out;\n}\n\n.selector-cycle-access .cycle-btn:hover {\n  border-color: var(--primary);\n}\n\n.selector-cycle-access .cycle-btn .icon-id {\n  color: var(--dark);\n  vertical-align: middle;\n  margin-right: 0.25rem;\n  font-size: 16px;\n}\n\n.selector-cycle-access .cycle-indicators {\n  display: flex;\n  gap: 0.25rem;\n  margin-top: 0.25rem;\n}\n\n.selector-cycle-access .cycle-indicators .cycle-indicator {\n  height: 4px;\n  width: 100%;\n  background-color: var(--light-dark);\n  border-radius: 4px;\n}\n\n.selector-cycle-access .cycle-indicators .cycle-indicator.active {\n  background-color: var(--primary);\n}\n\nbody.dyslexia_friendly {\n  --font-family: \"opendyslexic\", sans-serif !important;\n}\n\nbody.big_cursor,\nbody.big_cursor * {\n  cursor: url(\"https://cdn.userway.org/widgetapp/images/arrow_w.svg\"), auto !important;\n}\n\nbody.highlight_links a[href] {\n  background-color: var(--dark) !important;\n  border: 2px solid #f90 !important;\n  color: rgb(255, 255, 100) !important;\n  padding: 0.25em 0.5em;\n  border-radius: 10px;\n}\n\nbody.highlight_links a[href]:hover {\n  background-color: var(--dark) !important;\n}\n\nbody.highlight_links a[href]:focus {\n  outline: 3px solid #f90;\n  outline-offset: 2px;\n}\n\nbody.highlight_links a[href] * {\n  color: rgb(255, 255, 100) !important;\n}\n\ndiv[vw].enabled {\n  display: none !important;\n  margin: 0 !important;\n  top: auto !important;\n  bottom: 12px !important;\n  left: 8px !important;\n  right: initial !important;\n  z-index: 9998 !important;\n  transform: scale(0.72);\n  transform-origin: left bottom;\n}\n\nbody.vlibras_active div[vw].enabled {\n  display: block !important;\n}\n\nbody.vlibras_active div[vw] [vw-access-button] {\n  transform: scale(0.85);\n  transform-origin: left bottom;\n}\n\nbody.stop_animations *,\nbody.stop_animations *::before,\nbody.stop_animations *::after {\n  animation: none !important;\n  transition: none !important;\n  scroll-behavior: auto !important;\n  transition-timing-function: step-end !important;\n  transition-duration: 0s !important;\n  animation-timing-function: step-end !important;\n  animation-iteration-count: 1 !important;\n  animation-duration: 0s !important;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  * {\n    animation: none !important;\n    transition: none !important;\n    scroll-behavior: auto !important;\n  }\n}\nbody.hidden_illustrative_image img:not([alt]),\nbody.hidden_illustrative_image img[alt=\"\"] {\n  visibility: hidden !important;\n}\n\nbody.hidden_illustrative_image * {\n  background-image: none !important;\n}\n\nbody.remove_justify p,\nbody.remove_justify span,\nbody.remove_justify li,\nbody.remove_justify blockquote,\nbody.remove_justify td,\nbody.remove_justify div {\n  text-align: start !important;\n}\n\nbody.high_line_height {\n  --font-paragraph1: 400 calc(1rem * var(--font-scale)) / 1.8 var(--font-family);\n  --font-paragraph2: 400 calc(0.875rem * var(--font-scale)) / 1.8 var(--font-family);\n}\n\nbody.high_line_height p,\nbody.high_line_height li,\nbody.high_line_height td,\nbody.high_line_height th,\nbody.high_line_height blockquote {\n  line-height: 1.8 !important;\n}\n\nbody.high_line_height p {\n  margin-bottom: 2rem !important;\n}\n\nbody[data-zoom=\"120\"] {\n  --font-scale: 1.2;\n}\n\nbody[data-zoom=\"130\"] {\n  --font-scale: 1.3;\n}\n\nbody[data-zoom=\"150\"] {\n  --font-scale: 1.5;\n}\n\nbody[data-zoom=\"160\"] {\n  --font-scale: 1.6;\n}\n\nbody.color_mode_low_contrast ion-app,\nbody.color_mode_low_contrast ion-content, body.color_mode_low_contrast.vlibras_active div[vw].enabled {\n  filter: saturate(0.5);\n}\n\nbody.color_mode_colorblind {\n  --primary: #1f77b4;\n  --primary-dark: #144e75;\n  --primary-light: #d5e8f5;\n  --secondary: #ff7f0e;\n  --secondary-dark: #a85400;\n  --secondary-light: #ffe5c2;\n  --success: #1f77b4;\n  --success-dark: #144e75;\n  --success-light: #d5e8f5;\n  --danger: #d62728;\n  --danger-dark: #8b1a1c;\n  --danger-light: #f9d3d4;\n  --warning: #ffbf00;\n  --warning-dark: #b38600;\n  --warning-light: #fff5cc;\n  --info: #17becf;\n  --info-dark: #117c8a;\n  --info-light: #d4f4f8;\n  --light: #eaeaea;\n  --light-dark: #c8c8c8;\n  --light-lighter: #f7f7f7;\n  --dark: #2b2b2b;\n  --dark-darker: #141414;\n  --dark-light: #858585;\n  --general-white: #ffffff;\n  --bg-green: #fafdff;\n  --bg-green-gradient: linear-gradient(131.57deg, #f7fbfe 7.49%, #ffffff 84.71%);\n  --ion-color-primary: #1f77b4;\n  --ion-color-primary-shade: #1a68a0;\n  --ion-color-primary-tint: #3585bc;\n  --verde-tema: #1f77b4;\n  --verde-escuro: #144e75;\n}\n\nbody.color_mode_grayscale ion-app,\nbody.color_mode_grayscale ion-content, body.color_mode_grayscale.vlibras_active div[vw].enabled {\n  filter: grayscale(100%);\n}\n\nbody.color_mode_high_contrast {\n  background-color: #000 !important;\n  color: #fff !important;\n  --general-white: #000 !important;\n  --ion-background-color: #000;\n  --ion-text-color: #fff;\n}\n\nbody.color_mode_high_contrast a {\n  color: #ff0;\n}\n\nbody.color_mode_high_contrast h1,\nbody.color_mode_high_contrast h2,\nbody.color_mode_high_contrast h3,\nbody.color_mode_high_contrast h4,\nbody.color_mode_high_contrast h5,\nbody.color_mode_high_contrast h6 {\n  color: #fff;\n}\n\nbody.color_mode_high_contrast ion-toolbar,\nbody.color_mode_high_contrast .painel-card,\nbody.color_mode_high_contrast .curso-card,\nbody.color_mode_high_contrast .card {\n  background-color: var(--dark) !important;\n  color: #fff;\n  border: 1px solid var(--dark-light) !important;\n}\n\nbody.color_mode_high_contrast .ava-header-profile {\n  color: var(--dark);\n}\n\nbody.color_mode_high_contrast .ava-header-profile:hover, body.color_mode_high_contrast .ava-header-profile.active {\n  color: #fff !important;\n}\n\nbody.color_mode_high_contrast .sidebar-modal__panel {\n  background-color: var(--dark) !important;\n  border: 1px solid var(--dark-light);\n  color: #fff;\n}\n\nbody.color_mode_high_contrast .sidebar-modal__header,\nbody.color_mode_high_contrast .modal-content-body-title,\nbody.color_mode_high_contrast .ava-modal-body {\n  color: #fff !important;\n}\n\nbody.color_mode_high_contrast .modal-content-body-help-link,\nbody.color_mode_high_contrast .modal-button-option:not(.exit-button) {\n  color: #ff0 !important;\n}\n\nbody.color_mode_high_contrast .checkbox-access-label,\nbody.color_mode_high_contrast .selector-cycle-access .cycle-btn {\n  background-color: #1a1a1a;\n  color: #fff;\n}\n\nbody.color_mode_high_contrast {\n  --primary: #ffff00;\n  --primary-dark: #ffff00;\n  --primary-light: #222222;\n  --branco-primario: #111111;\n  --muted: #dddddd;\n  --cinza-primario: #888888;\n  --success-light: #17251a;\n  --success-dark: #afffb6;\n}\n\nbody.color_mode_high_contrast #main-content ion-toolbar {\n  --background: #111;\n  --color: #fff;\n}\n\nbody.color_mode_high_contrast .ava-header-title, body.color_mode_high_contrast #main-content .ava-header-title {\n  color: #fff;\n}\n\nbody.color_mode_high_contrast .sidebar-modal__header {\n  background: #111;\n}\n\nbody.color_mode_high_contrast .ava-modal-body__user, body.color_mode_high_contrast .filter-select-area, body.color_mode_high_contrast .filter-select-area select {\n  background: #111;\n  color: #fff;\n}\n\nbody.color_mode_high_contrast .modal-button-option, body.color_mode_high_contrast .modal-content-body-help-link {\n  background: #111;\n}\n\n.ava-splash,\n.page-loading.ava-splash,\n.boot-loading.ava-splash {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 1rem;\n  min-height: 50vh;\n  padding: 24px 16px;\n  text-align: center;\n  background: rgba(255, 255, 255, 0.92);\n  color: var(--dark);\n}\n\n.ava-splash--fullscreen {\n  position: fixed;\n  inset: 0;\n  z-index: 9999;\n  min-height: 100%;\n  background: var(--branco-primario);\n}\n\n.ava-splash__brand {\n  aspect-ratio: 1;\n  display: grid;\n  margin: 0 auto;\n  place-items: center;\n  position: relative;\n  width: min(132px, 34vw);\n  flex: 0 0 auto;\n  isolation: isolate;\n}\n\n.ava-splash__gauge {\n  animation: ava-spin 1.1s linear infinite;\n  inset: 0;\n  position: absolute;\n}\n\n.ava-splash__gauge-svg {\n  display: block;\n  height: 100%;\n  width: 100%;\n}\n\n.ava-splash__gauge-track {\n  fill: none;\n  stroke: rgba(19, 81, 180, 0.14);\n  stroke-width: 4;\n}\n\n.ava-splash__gauge-arc {\n  fill: none;\n  stroke: url(#ava-splash-gauge-grad);\n  stroke-dasharray: 68 271;\n  stroke-linecap: round;\n  stroke-width: 5;\n}\n\n.ava-splash__logo {\n  aspect-ratio: 1;\n  background: var(--branco-primario);\n  border-radius: 50%;\n  box-shadow: 0 2px 10px rgba(7, 29, 65, 0.12);\n  height: 74%;\n  object-fit: cover;\n  position: relative;\n  width: 74%;\n  z-index: 1;\n}\n\n.ava-splash__text {\n  color: var(--dark);\n  font: var(--font-button1);\n  margin: 0;\n}\n\n@keyframes ava-spin {\n  100% {\n    transform: rotate(360deg);\n  }\n}\nbody.stop_animations .ava-splash__gauge {\n  animation: none;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .ava-splash__gauge {\n    animation: none;\n    opacity: 0.9;\n  }\n}\n.ava-topbar, .tabs-row {\n  display: flex;\n  gap: 0;\n  overflow-x: auto;\n  margin: 8px 0 16px;\n  padding: 0;\n  background: var(--branco-primario);\n  border-bottom: 1px solid var(--light-dark);\n  -webkit-overflow-scrolling: touch;\n  overscroll-behavior-x: contain;\n  scrollbar-width: none;\n}\n\n.ava-topbar::-webkit-scrollbar, .tabs-row::-webkit-scrollbar {\n  display: none;\n}\n\n.ava-topbar .ava-tab, .tabs-row .ava-tab {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n  flex-shrink: 0;\n  min-height: 50px;\n  padding: 0 20px;\n  border: 0;\n  border-bottom: 3px solid transparent;\n  border-radius: 0;\n  background: transparent;\n  color: var(--muted);\n  font: var(--font-button2);\n  cursor: pointer;\n  white-space: nowrap;\n}\n\n.ava-topbar .ava-tab:hover:not(:disabled), .tabs-row .ava-tab:hover:not(:disabled) {\n  background: var(--primary-light);\n  color: var(--primary);\n}\n\n.ava-topbar .ava-tab.is-active, .tabs-row .ava-tab.is-active {\n  border-bottom-color: var(--primary);\n  color: var(--primary);\n  font-weight: 700;\n}\n\n.ava-topbar .ava-tab:disabled, .tabs-row .ava-tab:disabled {\n  opacity: 0.45;\n  cursor: not-allowed;\n}\n\n.ava-tab__label-desktop {\n  display: none;\n}\n\n.ava-tab__label-mobile {\n  display: inline;\n}\n\n.ava-tab__badge {\n  display: inline-grid;\n  place-items: center;\n  min-width: 22px;\n  height: 22px;\n  padding: 1px 6px;\n  border-radius: 999px;\n  background: var(--primary-light);\n  color: var(--primary);\n  font-size: 0.75rem;\n}\n\n.painel-filters {\n  display: flex;\n  align-items: center;\n  flex-wrap: wrap;\n  gap: 8px;\n  margin: 0 0 16px;\n}\n\n.painel-filter-button, .painel-filter-chip {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n  min-height: 44px;\n  padding: 8px 14px;\n  max-width: 100%;\n  border: 1px solid var(--primary);\n  border-radius: 999px;\n  background: var(--branco-primario);\n  color: var(--primary);\n  font: var(--font-button2);\n  cursor: pointer;\n}\n\n.painel-filter-button:hover, .painel-filter-button.active, .painel-filter-chip:hover, .painel-filter-chip.active {\n  background: var(--primary-light);\n}\n\n.painel-filter-chip {\n  border-color: transparent;\n  background: var(--primary-light);\n}\n\n.card-container {\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n  padding: 0;\n}\n\n.painel-card {\n  margin: 0;\n  width: 100%;\n  min-height: 100px;\n  border: 1px solid var(--cinza-primario);\n  border-radius: 4px;\n  background: var(--branco-primario);\n  box-shadow: none;\n  transition: box-shadow 0.2s ease, border-color 0.2s ease;\n}\n\n.painel-card:hover {\n  border-color: var(--muted);\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);\n}\n\n.painel-card ion-card-content {\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n  padding: 24px;\n}\n\n.painel-card-title {\n  margin: 0;\n  font: var(--font-heading1);\n  font-size: calc(1.35rem * var(--font-scale));\n  color: var(--primary-dark);\n  overflow-wrap: anywhere;\n}\n\n.painel-card-header-shortname {\n  display: block;\n  margin-top: 8px;\n  font-size: calc(0.85rem * var(--font-scale));\n  line-height: 1.5;\n  color: var(--muted);\n  overflow-wrap: anywhere;\n}\n\n.painel-card-link {\n  display: block;\n  color: inherit;\n  text-decoration: none;\n}\n\n.painel-card-details {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 12px;\n}\n\n.painel-card:not(.painel-card--autoinscricao) .painel-card-details {\n  order: -1;\n}\n\n.painel-card-details-info {\n  display: flex;\n  align-items: center;\n  flex-wrap: wrap;\n  gap: 8px;\n  width: 100%;\n}\n\n.painel-card-info-icon, .painel-card-details-info-published, .painel-card-details-info-unpublished {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  padding: 4px 8px;\n  border-radius: 4px;\n  min-height: 26px;\n  background: var(--primary-light);\n  color: var(--primary);\n  font-size: calc(0.75rem * var(--font-scale));\n  font-weight: 600;\n}\n\n.painel-card-info-icon span, .painel-card-details-info-published span, .painel-card-details-info-unpublished span {\n  overflow-wrap: anywhere;\n}\n\n.painel-card-info-icon ion-icon, .painel-card-details-info-published ion-icon, .painel-card-details-info-unpublished ion-icon {\n  flex-shrink: 0;\n  font-size: 14px;\n}\n\n.painel-card-details-info-published, .painel-card-info-enrolled {\n  background: var(--success-light);\n  color: var(--success-dark);\n}\n\n.painel-card-details-info-unpublished {\n  background: var(--light);\n  color: var(--dark);\n}\n\n.painel-card-details-info-favourite, .painel-card-details-info-unfavourite {\n  display: grid;\n  place-items: center;\n  width: 44px;\n  height: 44px;\n  margin-left: auto;\n  border: 0;\n  border-radius: 50%;\n  padding: 0;\n  background: transparent;\n  color: var(--primary);\n  cursor: pointer;\n}\n\n.painel-card-details-info-favourite ion-icon, .painel-card-details-info-unfavourite ion-icon {\n  font-size: 22px;\n}\n\n.painel-card-details-info-favourite:hover, .painel-card-details-info-unfavourite:hover {\n  background: var(--primary-light);\n}\n\n.painel-card-details-info-favourite[aria-pressed=true], .painel-card-details-info-unfavourite[aria-pressed=true] {\n  color: var(--primary-dark);\n  background: var(--primary-light);\n}\n\n.painel-card-details-info-favourite:disabled, .painel-card-details-info-unfavourite:disabled {\n  opacity: 0.45;\n  cursor: default;\n}\n\n.painel-card-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n  width: 100%;\n}\n\n.painel-card-actions ion-button {\n  margin: 0;\n  min-height: 44px;\n  --border-radius: 999px;\n  font: var(--font-button2);\n  text-transform: none;\n}\n\n.no-data__hint {\n  margin: 0;\n  max-width: 28rem;\n}\n\n@media (min-width: 768px) {\n  .ava-tab__label-desktop {\n    display: inline;\n  }\n  .ava-tab__label-mobile {\n    display: none;\n  }\n}\n@media (max-width: 767.98px) {\n  .ava-topbar .ava-tab, .tabs-row .ava-tab {\n    padding-inline: 12px;\n  }\n  .painel-card ion-card-content {\n    padding: 16px;\n    gap: 12px;\n  }\n  .painel-card-title {\n    font-size: calc(1.125rem * var(--font-scale));\n  }\n  .painel-card-actions ion-button {\n    flex: 1 1 auto;\n  }\n}\n.breadcrumb {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  margin-bottom: 16px;\n  font-size: 0.8rem;\n  color: var(--muted);\n}\n\n.breadcrumb a {\n  color: var(--primary);\n  text-decoration: none;\n  font-weight: 600;\n}\n\n.breadcrumb strong {\n  color: var(--dark);\n}\n\n.detail-content {\n  max-width: var(--max-width-layout);\n  width: 100%;\n  margin: 0 auto;\n}\n\n.enrol-header {\n  padding-block: 1.25rem;\n  display: flex;\n  justify-content: space-between;\n  gap: 1.5rem;\n  align-items: flex-end;\n}\n\n.course-header h1,\n.course-header .painel-card-title {\n  margin: 0;\n  font: var(--font-heading1);\n  color: var(--dark);\n}\n\n.enrol-header-tag,\n.env-chip {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  font: var(--font-heading5);\n  padding: 0.25rem 0.5rem;\n  border-radius: 32px;\n  background-color: var(--success-light);\n  color: var(--success-dark);\n  margin-bottom: 0.5rem;\n}\n\n.enrol-header-topics {\n  display: flex;\n  gap: 1rem;\n  flex-wrap: wrap;\n  margin-top: 1rem;\n}\n\n.topic-item {\n  display: inline-flex;\n  align-items: center;\n  gap: 0.4rem;\n  font: var(--font-paragraph2);\n  color: var(--cinza-secundario);\n}\n\n.topic-item ion-icon {\n  color: var(--secondary);\n  font-size: 1rem;\n}\n\n.course-actions ion-button {\n  --border-radius: 8px;\n  font: var(--font-button2);\n  text-transform: none;\n}\n\n.course-hero {\n  margin: 0 0 14px;\n  border: 1px solid var(--light);\n  box-shadow: 1px 1px 8px rgba(20, 20, 20, 0.18);\n  border-radius: 8px;\n}\n\n.course-meta {\n  margin: 12px 0;\n  padding: 0;\n  list-style: none;\n  color: var(--cinza-secundario);\n}\n\n.course-meta li {\n  margin-bottom: 4px;\n}\n\n.course-summary {\n  margin: 1.25rem 0;\n}\n\n.course-summary h2 {\n  margin: 0 0 0.5rem;\n  font: var(--font-heading2);\n}\n\n.course-summary-content {\n  border-top: 1px solid var(--light-dark);\n  padding-top: 1rem;\n  font: var(--font-paragraph1);\n  color: var(--dark);\n}\n\n.section-title {\n  margin: 8px 0 12px;\n  font: var(--font-heading2);\n}\n\n.course-progress {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-bottom: 4px;\n}\n\n.course-progress ion-progress-bar {\n  flex: 1;\n  max-width: 187px;\n  height: 4px;\n  border-radius: 50px;\n  --background: #e3e3e3;\n  --progress-background: var(--dsgov-blue-70);\n}\n\n.course-progress span {\n  font-size: 0.75rem;\n  color: var(--muted);\n}\n\n.course-sections {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  margin-bottom: 20px;\n}\n\n.topic-card {\n  margin: 0;\n  border: 1px solid var(--light);\n  box-shadow: 1px 1px 8px rgba(20, 20, 20, 0.12);\n  border-radius: 8px;\n  background: var(--branco-primario);\n  overflow: hidden;\n}\n\n.topic-card__header {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  width: 100%;\n  padding: 14px 16px;\n  border: none;\n  background: transparent;\n  text-align: left;\n  cursor: pointer;\n  color: inherit;\n  font: inherit;\n}\n\n.topic-card__header:active {\n  background: var(--bg-green);\n}\n\n.topic-index {\n  display: grid;\n  place-items: center;\n  width: 36px;\n  height: 36px;\n  border-radius: 50%;\n  background: var(--primary-light);\n  color: var(--primary-dark);\n  font-weight: 700;\n  flex-shrink: 0;\n}\n\n.topic-card__meta {\n  flex: 1;\n  min-width: 0;\n}\n\n.topic-card h3,\n.topic-name {\n  margin: 0;\n  font-size: 1rem;\n  font-weight: 700;\n  color: var(--dark);\n}\n\n.topic-card__count {\n  margin: 2px 0 0;\n  font-size: 0.8rem;\n  color: var(--muted);\n}\n\n.topic-card__chevron {\n  color: var(--primary);\n  font-size: 1.25rem;\n  transition: transform 0.2s ease;\n  flex-shrink: 0;\n}\n\n.topic-card.is-open .topic-card__chevron {\n  transform: rotate(180deg);\n}\n\n.topic-card__body {\n  display: none;\n  border-top: 1px solid var(--light);\n  padding: 4px 8px 12px;\n}\n\n.topic-card.is-open .topic-card__body {\n  display: block;\n}\n\n.activity-list {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n}\n\n.activity-item {\n  display: flex;\n  align-items: flex-start;\n  gap: 12px;\n  padding: 12px 10px;\n  border-radius: 8px;\n  text-decoration: none;\n  color: inherit;\n  transition: background 0.15s ease;\n  -webkit-tap-highlight-color: transparent;\n}\n\n.activity-item:active, .activity-item:focus-visible {\n  background: var(--bg-green);\n  outline: none;\n}\n\n.activity-item--link {\n  cursor: pointer;\n}\n\n.activity-item--link:hover {\n  background: var(--primary-light);\n}\n\n.activity-item--link .activity-item__name {\n  color: var(--primary-dark);\n}\n\n.activity-item--static {\n  cursor: default;\n  opacity: 0.92;\n}\n\n.activity-item__icon {\n  display: grid;\n  place-items: center;\n  width: 36px;\n  height: 36px;\n  border-radius: 8px;\n  background: var(--primary-light);\n  color: var(--primary-dark);\n  flex-shrink: 0;\n  font-size: 1.15rem;\n}\n\n.activity-item__body {\n  flex: 1;\n  min-width: 0;\n}\n\n.activity-item__name {\n  margin: 0;\n  font: var(--font-heading3);\n  color: var(--dark);\n}\n\n.activity-item__mod {\n  margin: 2px 0 0;\n  font: var(--font-heading6);\n  color: var(--muted);\n  text-transform: uppercase;\n  letter-spacing: 0.02em;\n}\n\n.activity-item__status {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  margin-top: 6px;\n  padding: 2px 8px;\n  border-radius: 4px;\n  font: var(--font-heading6);\n  background: var(--success-light);\n  color: var(--success-dark);\n}\n\n.activity-item__status--pending {\n  background: var(--warning-light);\n  color: var(--warning-dark);\n}\n\n.activity-item__chevron {\n  flex-shrink: 0;\n  align-self: center;\n  font-size: 1.1rem;\n  color: var(--primary);\n}\n\n.activity-empty {\n  padding: 12px 10px;\n  font: var(--font-paragraph2);\n  color: var(--muted);\n}\n\n@media (max-width: 767.98px) {\n  .enrol-header {\n    flex-direction: column;\n    align-items: flex-start;\n  }\n}\n@media (max-width: 767.98px) {\n  ion-app {\n    padding-left: max(env(safe-area-inset-left), var(--ion-safe-area-left, 0px));\n    padding-right: max(env(safe-area-inset-right), var(--ion-safe-area-right, 0px));\n  }\n  .ava-toolbar {\n    --min-height: 64px;\n  }\n  .ava-toolbar-inner {\n    min-height: 64px;\n    gap: 8px;\n    padding: 8px 12px;\n  }\n  .ava-header-logo {\n    height: 32px;\n  }\n  .ava-header-title {\n    font-size: 1rem;\n  }\n  .ava-header-subtitle, .ava-header-profile span {\n    display: none;\n  }\n  .ava-header-actions {\n    gap: 0;\n  }\n  .painel-page,\n  .curso-page {\n    padding: 4px 12px calc(24px + env(safe-area-inset-bottom));\n  }\n  .page-intro {\n    padding: 4px 2px 12px;\n  }\n  .page-intro h2 {\n    font: var(--font-heading2);\n  }\n  .page-intro p {\n    font-size: 0.875rem;\n    line-height: 1.45;\n  }\n  .no-data {\n    margin-top: 1.25rem;\n    padding: 16px 12px;\n    min-height: 30vh;\n  }\n  .breadcrumb {\n    font-size: 0.75rem;\n    gap: 4px;\n    margin-bottom: 12px;\n  }\n  .enrol-header {\n    flex-direction: column;\n    align-items: stretch;\n    gap: 1rem;\n    padding-block: 0.75rem;\n  }\n  .course-header h1,\n  .course-header .painel-card-title {\n    font: var(--font-heading2);\n    overflow-wrap: anywhere;\n  }\n  .enrol-header-topics {\n    gap: 0.65rem;\n  }\n  .topic-item {\n    font-size: 0.8125rem;\n    width: 100%;\n  }\n  .course-actions {\n    width: 100%;\n  }\n  .course-actions ion-button {\n    width: 100%;\n    margin: 0;\n  }\n  .course-progress {\n    width: 100%;\n    flex-wrap: wrap;\n  }\n  .course-progress ion-progress-bar {\n    max-width: none;\n    width: 100%;\n    flex: 1 1 100%;\n  }\n  .course-summary {\n    margin: 1rem 0;\n  }\n  .section-title {\n    margin: 4px 0 10px;\n  }\n  .topic-card__header {\n    padding: 12px;\n    gap: 10px;\n    min-height: 56px;\n  }\n  .topic-index {\n    width: 32px;\n    height: 32px;\n    font-size: 0.875rem;\n  }\n  .topic-name {\n    font-size: 0.9375rem;\n    overflow-wrap: anywhere;\n  }\n  .topic-card__body {\n    padding: 2px 6px 10px;\n  }\n  .activity-item {\n    padding: 12px 8px;\n    gap: 10px;\n    min-height: 52px;\n  }\n  .activity-item__icon {\n    width: 32px;\n    height: 32px;\n    font-size: 1rem;\n  }\n  .activity-item__name {\n    font-size: 0.9375rem;\n    overflow-wrap: anywhere;\n  }\n  .sidebar-modal__panel {\n    width: min(100vw, 100%);\n    max-width: 100%;\n    border-radius: 0;\n    padding-bottom: env(safe-area-inset-bottom);\n  }\n  .sidebar-modal__header {\n    padding-top: calc(16px + max(32px, var(--ifrn-safe-area-top, 0px), var(--ion-safe-area-top, 0px), var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px)));\n  }\n  .sidebar-modal__body {\n    padding: 12px 14px calc(16px + env(safe-area-inset-bottom));\n  }\n  .checkbox-access-label {\n    padding: 0.65rem 0.85rem;\n    min-height: 44px;\n  }\n  .cycle-btn {\n    min-height: 44px;\n  }\n  .ava-splash,\n  .page-loading.ava-splash,\n  .boot-loading.ava-splash {\n    min-height: calc(100dvh - 120px);\n    padding: 20px 16px calc(24px + env(safe-area-inset-bottom));\n    gap: 0.85rem;\n  }\n  .ava-splash__brand {\n    width: min(120px, 36vw);\n  }\n  .ava-splash__logo {\n    height: 86%;\n    width: 86%;\n  }\n  .ava-splash__gauge-track {\n    stroke-width: 3.5;\n  }\n  .ava-splash__gauge-arc {\n    stroke-width: 4.5;\n  }\n  .ava-splash__text {\n    font-size: 0.9375rem;\n    padding-inline: 8px;\n  }\n}\n@media (max-width: 379.98px) {\n  .painel-page,\n  .curso-page {\n    padding-inline: 10px;\n  }\n}\n@media (max-width: 767.98px) and (orientation: portrait) {\n  .painel-page,\n  .curso-page {\n    min-height: 0;\n  }\n  .ava-topbar,\n  .tabs-row {\n    flex-wrap: nowrap;\n    scrollbar-width: none;\n  }\n  .ava-topbar::-webkit-scrollbar,\n  .tabs-row::-webkit-scrollbar {\n    display: none;\n  }\n  .sidebar-modal__panel {\n    width: min(100vw, 100%);\n    border-radius: 0;\n    align-self: flex-end;\n  }\n}\n@media (max-width: 900px) and (orientation: landscape) {\n  .ava-splash,\n  .page-loading.ava-splash,\n  .boot-loading.ava-splash {\n    min-height: 70vh;\n    flex-direction: row;\n    flex-wrap: wrap;\n    justify-content: center;\n    align-content: center;\n  }\n  .ava-splash__brand {\n    width: 108px;\n  }\n  .ava-splash__logo {\n    height: 84%;\n    width: 84%;\n  }\n  .ava-toolbar {\n    --min-height: 44px;\n  }\n  .ava-toolbar-inner {\n    min-height: 44px;\n    height: 44px;\n  }\n  .ava-header-subtitle {\n    display: none;\n  }\n}\nhtml,\nbody,\nion-app,\nion-content,\nion-header,\nion-toolbar,\nion-title,\nion-button,\nion-label {\n  font-family: var(--font-family, var(--dsgov-font-family));\n}\n\nbody,\nion-content#page-content {\n  background: var(--dsgov-bg-light-gray);\n  color: var(--dsgov-text-dark);\n}\n\n.course-progress ion-progress-bar {\n  --background: var(--dsgov-bg-progress-track);\n  --progress-background: var(--dsgov-blue-70);\n  height: 10px;\n  border-radius: var(--dsgov-radius-pill-sm);\n}\n\n.breadcrumb {\n  background: var(--dsgov-bg-white);\n  border: 1px solid #cccccc;\n  border-radius: var(--dsgov-radius-sm);\n  padding: 10px 20px;\n  font-size: var(--dsgov-font-size-sm);\n  color: var(--dsgov-text-dark);\n  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);\n}\n\n.breadcrumb a {\n  color: var(--dsgov-blue-70);\n  font-weight: var(--dsgov-font-weight-semibold);\n  text-decoration: none;\n}\n\n.breadcrumb a:hover {\n  color: var(--dsgov-blue-90);\n  text-decoration: underline;\n}\n\n.breadcrumb strong {\n  color: var(--dsgov-text-medium);\n  font-weight: var(--dsgov-font-weight-normal);\n}\n\nion-button {\n  --border-radius: var(--dsgov-radius-pill);\n  font-weight: var(--dsgov-font-weight-semibold);\n  text-transform: none;\n  letter-spacing: normal;\n}\n\n#main-content ion-header ion-toolbar {\n  --background: var(--dsgov-bg-white);\n  --color: var(--dsgov-blue-90);\n  --border-color: var(--dsgov-border-inner);\n}\n\n.sidebar-modal__panel {\n  border-radius: 0;\n}\n\n.modal-button-option,\n.modal-content-body-filter-button {\n  border-radius: var(--dsgov-radius-pill);\n  font-weight: var(--dsgov-font-weight-semibold);\n}\n\n.modal-content-body-filter-button,\nion-button[color=primary] {\n  --background: var(--dsgov-blue-70);\n  --background-activated: var(--dsgov-blue-90);\n  --background-hover: var(--dsgov-blue-90);\n  --border-radius: var(--dsgov-radius-pill);\n}\n\n.filter-select-area select {\n  border: 1px solid #cccccc;\n  border-radius: var(--dsgov-radius-default);\n  font-size: var(--dsgov-font-size-base);\n}\n\n.filter-select-area select:focus {\n  box-shadow: var(--dsgov-focus-ring-blue);\n}\n\n.checkbox-access-label {\n  border-radius: var(--dsgov-radius-default);\n}\n\n.checkbox-access-label:focus-within:focus-visible {\n  outline: 2px solid #1351b4 !important;\n  outline-offset: 2px !important;\n  box-shadow: none !important;\n}\n\n.checkbox-access-label:focus-within:focus:not(:focus-visible) {\n  outline: none !important;\n  box-shadow: none !important;\n}\n\n.cycle-btn {\n  border-radius: var(--dsgov-radius-default);\n}\n\n.course-header h1,\n.course-header .painel-card-title {\n  color: var(--dsgov-blue-90);\n}\n\n.env-chip,\n.enrol-header-tag {\n  background: var(--dsgov-green-badge-bg);\n  color: var(--dsgov-green-60);\n  border-radius: var(--dsgov-radius-pill-sm);\n  font-weight: var(--dsgov-font-weight-semibold);\n}\n\n.topic-index {\n  background: var(--dsgov-blue-badge-bg);\n  color: var(--dsgov-blue-70);\n  font-weight: var(--dsgov-font-weight-bold);\n}\n\n.topic-card {\n  border: 1px solid #cccccc;\n  border-radius: var(--dsgov-radius-default);\n}\n\n.activity-item {\n  border-radius: var(--dsgov-radius-default);\n}\n\n.activity-item:focus-visible:focus-visible {\n  outline: 2px solid #1351b4 !important;\n  outline-offset: 2px !important;\n  box-shadow: none !important;\n}\n\n.activity-item:focus-visible:focus:not(:focus-visible) {\n  outline: none !important;\n  box-shadow: none !important;\n}\n\n.page-error h3,\n.empty-state h3,\n.no-data h3 {\n  color: var(--dsgov-blue-90);\n}\n\n.status-page {\n  min-height: calc(100dvh - var(--header-height, 88px));\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 32px 20px 56px;\n  box-sizing: border-box;\n  text-align: center;\n}\n\n.status-page__card {\n  width: min(100%, 440px);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  padding: 32px 24px;\n  border: 1px solid rgba(19, 81, 180, 0.12);\n  border-radius: 20px;\n  background: var(--surface, #fff);\n  box-shadow: 0 8px 28px rgba(7, 29, 65, 0.08);\n}\n\n.status-page__icon {\n  width: 72px;\n  height: 72px;\n  display: grid;\n  place-items: center;\n  margin-bottom: 14px;\n  border-radius: 50%;\n  background: var(--primary-light, #e8f1ff);\n}\n\n.status-page__icon svg {\n  width: 34px;\n  height: 34px;\n  fill: var(--primary, #1351b4);\n}\n\n.status-page__code {\n  margin: 0 0 8px;\n  padding: 4px 10px;\n  border-radius: 999px;\n  background: var(--primary-light, #e8f1ff);\n  color: var(--primary, #1351b4);\n  font-size: 0.78rem;\n  font-weight: 700;\n  line-height: 1.4;\n}\n\n.status-page__code::before {\n  content: \"Erro \";\n}\n\n.status-page__title {\n  margin: 4px 0 10px;\n  color: var(--text-primary, #1b1b1b);\n  font-size: clamp(1.45rem, 5vw, 1.8rem);\n  font-weight: 600;\n  line-height: 1.2;\n}\n\n.status-page__message {\n  max-width: 340px;\n  margin: 0;\n  color: var(--text-secondary, #555);\n  font-size: 1rem;\n  line-height: 1.55;\n}\n\n.status-page__actions {\n  width: 100%;\n  margin-top: 24px;\n  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n  gap: 10px;\n}\n\n.status-page__actions ion-button {\n  width: 100%;\n  min-height: 48px;\n  margin: 0;\n  font-weight: 600;\n  --border-radius: 24px;\n  --box-shadow: 0 3px 10px rgba(19, 81, 180, 0.2);\n}\n\n@media (max-width: 480px) {\n  .status-page {\n    padding: 24px 16px 40px;\n  }\n  .status-page__card {\n    padding: 28px 20px;\n    border-radius: 18px;\n  }\n}".replaceAll('__IFRN_THEME_BASE__', base);
        document.head.appendChild(style);
    })();
"use strict";
(() => {
  // src/MoodleIFRN/mobilemoodle/core_mobile/namespace.ts
  /*!
   * namespace.ts
   * ----------------------------------------------------------------------------
   * Cria (ou reutiliza) o objeto global compartilhado entre todos os módulos:
   *
   *   window.MobileMoodle  →  MM   (funções de API + helpers)
   *   window.MobileMoodle.App → App (DOM, render, sidebar, rotas…)
   *
   * Cada arquivo .ts importa MM/App daqui e “pendura” suas funções nesses objetos.
   * Assim o bundle IIFE funciona sem classes/DI do Angular.
   */
  var MM = window.MobileMoodle = window.MobileMoodle || {};
  var App = MM.App = MM.App || {};

  // src/MoodleIFRN/mobilemoodle/core_mobile/api-errors.ts
  /*!
   * api-errors.ts
   * ----------------------------------------------------------------------------
   * Padroniza falhas da API para a UI.
   *
   * - messageForStatus / titleForStatus → textos amigáveis por código HTTP
   * - isRetryable → decide se mostra botão “Tentar novamente”
   * - ApiError → construtor estilo Error com status, title, message, retryable
   *
   * Exposto em MM para os outros módulos (api-http, app-status…).
   */
  function messageForStatus(status, detail) {
    switch (status) {
      case 401:
      case 403:
        return "Sess\xE3o expirada. Entre novamente.";
      case 404:
        return "O recurso solicitado n\xE3o foi encontrado.";
      case 408:
        return "A requisi\xE7\xE3o demorou demais. Tente novamente.";
      case 429:
        return "Muitas tentativas. Aguarde e tente de novo.";
      case 500:
        return "Ocorreu um erro interno no servidor. Tente novamente em instantes.";
      case 502:
        return "O servi\xE7o est\xE1 temporariamente indispon\xEDvel (gateway). Verifique a conex\xE3o e tente de novo.";
      case 503:
        return "O servi\xE7o est\xE1 em manuten\xE7\xE3o ou sobrecarregado. Tente novamente em breve.";
      case 504:
        return "Tempo esgotado no servidor. A conex\xE3o est\xE1 lenta ou o servi\xE7o n\xE3o respondeu.";
      default:
        if (status >= 500) {
          return "Erro no servidor (" + status + "). Tente novamente em instantes.";
        }
        return detail || "N\xE3o foi poss\xEDvel carregar os dados do painel.";
    }
  }
  function titleForStatus(status) {
    switch (status) {
      case 401:
      case 403:
        return "Acesso n\xE3o autorizado";
      case 404:
        return "N\xE3o encontrado";
      case 408:
      case 504:
        return "Tempo esgotado";
      case 429:
        return "Muitas tentativas";
      case 500:
        return "Erro interno do servidor";
      case 502:
        return "Servi\xE7o indispon\xEDvel";
      case 503:
        return "Servi\xE7o em manuten\xE7\xE3o";
      case 0:
        return "Falha de conex\xE3o";
      default:
        if (status >= 500) {
          return "Erro no servidor";
        }
        return "Algo deu errado";
    }
  }
  function isRetryable(status) {
    return status === 0 || status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || status >= 500;
  }
  function ApiError(status, detail) {
    const code = Number(status) || 0;
    this.name = "ApiError";
    this.status = code;
    this.title = titleForStatus(code);
    this.message = messageForStatus(code, detail);
    this.retryable = isRetryable(code);
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;
  MM.messageForStatus = messageForStatus;
  MM.titleForStatus = titleForStatus;
  MM.isRetryable = isRetryable;
  MM.ApiError = ApiError;

  // src/MoodleIFRN/mobilemoodle/core_mobile/oauth-profile.ts
  var OAUTH_PROFILE_KEY = "ifrn_suap_oauth_profile_v1";
  var OAUTH_PROFILE_MAX_AGE_SECONDS = 30 * 24 * 3600;
  function profileIdentity(profile) {
    const value = profile["identificacao"];
    return typeof value === "string" || typeof value === "number" && Number.isSafeInteger(value) ? String(value).trim() : "";
  }
  function hasOAuthProfileMode() {
    return sessionStorage.getItem(OAUTH_PROFILE_KEY) !== null || localStorage.getItem(OAUTH_PROFILE_KEY) !== null;
  }
  function readOAuthProfile() {
    try {
      let raw = sessionStorage.getItem(OAUTH_PROFILE_KEY);
      if (!raw) {
        raw = localStorage.getItem(OAUTH_PROFILE_KEY);
      }
      const value = JSON.parse(raw || "null");
      const currentUsername = sessionStorage.getItem("ifrn_username") || localStorage.getItem("ifrn_username");
      if (!value || !value.profile || typeof value.profile !== "object" || Array.isArray(value.profile) || !value.identity || profileIdentity(value.profile) !== value.identity || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now() || currentUsername && currentUsername !== value.identity) {
        return null;
      }
      if (!sessionStorage.getItem("ifrn_username")) {
        sessionStorage.setItem("ifrn_username", value.identity);
      }
      if (raw) {
        sessionStorage.setItem(OAUTH_PROFILE_KEY, raw);
      }
      return value;
    } catch {
      return null;
    }
  }
  function readOAuthDashboard() {
    const snapshot = readOAuthProfile();
    if (!snapshot) {
      return null;
    }
    try {
      const storage = sessionStorage.getItem("ifrn_painel_dashboard") !== null ? sessionStorage : localStorage;
      const raw = storage.getItem("ifrn_painel_dashboard");
      const owner = storage.getItem("ifrn_painel_owner");
      if (!raw || !owner || owner.trim().toLowerCase() !== snapshot.identity.trim().toLowerCase()) {
        return null;
      }
      const dashboard = JSON.parse(raw);
      if (!dashboard || typeof dashboard !== "object") {
        return null;
      }
      sessionStorage.setItem("ifrn_painel_dashboard", raw);
      sessionStorage.setItem("ifrn_painel_owner", owner);
      sessionStorage.setItem("ifrn_painel_profile", JSON.stringify(snapshot.profile));
      return dashboard;
    } catch {
      return null;
    }
  }

  // src/MoodleIFRN/mobilemoodle/core_mobile/api-auth.ts
  /*!
   * api-auth.ts
   * ----------------------------------------------------------------------------
   * Sessão JWT do painel.
   *
   * Fluxo típico após o login IFRN:
   *   1. App abre mobilemoodle/index.html (token pode vir em ?token= uma vez)
   *   2. getToken() valida, salva em sessionStorage e remove o token da URL
   *   3. Demais requests usam Authorization: Bearer …
   *
   * Segurança: formato JWT, tamanho máximo, exp se existir; token inválido é apagado.
   */
  var TOKEN_KEY = "ifrn_access_token";
  var JWT_SHAPE = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;
  function readJwtPayload(token) {
    try {
      const part = token.split(".")[1];
      const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
      const json = window.atob(padded);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
  function isValidToken(token) {
    if (typeof token !== "string" || !JWT_SHAPE.test(token) || token.length >= 4096) {
      return false;
    }
    const payload = readJwtPayload(token);
    if (!payload || typeof payload !== "object") {
      return false;
    }
    if (typeof payload.exp === "number" && payload.exp * 1e3 <= Date.now()) {
      return false;
    }
    return true;
  }
  function stripTokenFromUrl() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("token")) {
        return;
      }
      url.searchParams.delete("token");
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch {
    }
  }
  function getToken() {
    if (hasOAuthProfileMode()) {
      return null;
    }
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get("token");
    if (queryToken && isValidToken(queryToken)) {
      sessionStorage.setItem(TOKEN_KEY, queryToken);
      stripTokenFromUrl();
      return queryToken;
    }
    if (queryToken) {
      stripTokenFromUrl();
    }
    const stored = sessionStorage.getItem(TOKEN_KEY);
    if (stored && isValidToken(stored)) {
      return stored;
    }
    if (stored) {
      clearToken();
    }
    return null;
  }
  function setToken(token) {
    if (!isValidToken(token)) {
      clearToken();
      return false;
    }
    sessionStorage.setItem(TOKEN_KEY, token);
    return true;
  }
  function clearToken() {
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of [
        OAUTH_PROFILE_KEY,
        TOKEN_KEY,
        "ifrn_refresh_token",
        "ifrn_username",
        "ifrn_painel_token",
        "ifrn_painel_profile",
        "ifrn_painel_dashboard",
        "ifrn_painel_owner"
      ]) {
        storage.removeItem(key);
      }
    }
    sessionStorage.removeItem("ifrn_moodle_pending_open_course");
    sessionStorage.removeItem("ifrn_moodle_poc_oauth_pending");
    sessionStorage.removeItem("ifrn_moodle_poc_resume_oauth");
    sessionStorage.removeItem("ifrn_moodle_identity_mismatch");
    if (typeof MM.invalidateCache === "function") {
      MM.invalidateCache();
    }
  }
  MM.TOKEN_KEY = TOKEN_KEY;
  MM.isValidToken = isValidToken;
  MM.getToken = getToken;
  MM.setToken = setToken;
  MM.clearToken = clearToken;

  // src/MoodleIFRN/mobilemoodle/core_mobile/api-http.ts
  /*!
   * api-http.ts
   * ----------------------------------------------------------------------------
   * Cliente HTTP do painel.
   *
   * - Exige JWT (MM.getToken)
   * - Timeout 15s via AbortController
   * - 401/403 limpam a sessão
   * - Só aceita base URL da mesma origem (ou localhost em dev)
   * - Paths devem ser relativos seguros ("/dashboard/", não "//evil…")
   */
  var DEFAULT_BASE_URL = "";
  var REQUEST_TIMEOUT_MS = 15e3;
  var baseUrl = DEFAULT_BASE_URL;
  function isAllowedApiBase(url) {
    try {
      const parsed = new URL(url);
      const origin = window.location.origin;
      if (parsed.origin === origin) {
        return true;
      }
      if (parsed.origin === "https://suap.ifrn.edu.br") {
        return true;
      }
      if (parsed.origin === "https://ava.ifrn.edu.br") {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  function isSafeApiPath(path) {
    return typeof path === "string" && path.charAt(0) === "/" && path.charAt(1) !== "/" && !/^[a-z][a-z0-9+.-]*:/i.test(path) && path.indexOf("\\") === -1;
  }
  function setApiBaseUrl(url) {
    if (typeof url !== "string") {
      baseUrl = DEFAULT_BASE_URL;
      return;
    }
    const cleaned = url.trim().replace(/\/+$/, "");
    if (!cleaned || !isAllowedApiBase(cleaned)) {
      baseUrl = DEFAULT_BASE_URL;
      return;
    }
    baseUrl = cleaned;
  }
  function joinUrl(path) {
    if (!isSafeApiPath(path)) {
      throw new MM.ApiError(400, "Caminho de API inv\xE1lido.");
    }
    if (!baseUrl) {
      return path;
    }
    return baseUrl + path;
  }
  async function readError(response) {
    try {
      const data = await response.json();
      const message = data && (data.detail || data.message);
      if (typeof message === "string") {
        return message.slice(0, 280);
      }
      return response.statusText;
    } catch {
      try {
        const text = await response.text();
        return (text || response.statusText).slice(0, 280);
      } catch {
        return response.statusText;
      }
    }
  }
  async function request(path, options) {
    const token = MM.getToken();
    if (!token) {
      throw new MM.ApiError(401);
    }
    if (!isSafeApiPath(path)) {
      throw new MM.ApiError(400, "Caminho de API inv\xE1lido.");
    }
    const softAuth = Boolean(options && options.softAuth);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    const headers = {
      Accept: "application/json",
      Authorization: "Bearer " + token
    };
    let response;
    try {
      response = await fetch(joinUrl(path), {
        method: options && options.method || "GET",
        headers,
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
        body: options && options.body
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new MM.ApiError(408);
      }
      throw new MM.ApiError(0, "Falha de rede. Confira a conex\xE3o e tente novamente.");
    } finally {
      window.clearTimeout(timeoutId);
    }
    if (response.status === 401 || response.status === 403) {
      if (!softAuth) {
        MM.clearToken();
      }
      throw new MM.ApiError(response.status);
    }
    if (!response.ok) {
      const detail = await readError(response);
      throw new MM.ApiError(response.status, detail);
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new MM.ApiError(502, "Resposta inv\xE1lida do servidor.");
    }
    return response.json();
  }
  MM.setApiBaseUrl = setApiBaseUrl;
  MM.joinUrl = joinUrl;
  MM.request = request;

  // src/MoodleIFRN/mobilemoodle/core_mobile/api-suap.ts
  /*!
   * api-suap.ts
   * ----------------------------------------------------------------------------
   * Adapta endpoints oficiais do SUAP para o formato interno do painel
   * (DashboardData / CourseData).
   *
   * Autenticação: Bearer JWT de POST /api/token/pair
   * Docs: https://suap.ifrn.edu.br/api/docs/
   */
  function asPagedResults(data) {
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === "object" && Array.isArray(data.results)) {
      return data.results;
    }
    return [];
  }
  function absoluteSuapUrl(pathOrUrl) {
    if (!pathOrUrl) {
      return void 0;
    }
    if (/^https?:\/\//i.test(pathOrUrl) || pathOrUrl.startsWith("data:")) {
      return pathOrUrl;
    }
    if (pathOrUrl.startsWith("/")) {
      return "https://suap.ifrn.edu.br" + pathOrUrl;
    }
    return pathOrUrl;
  }
  function resolveExternalLink(value) {
    if (!value) {
      return void 0;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return void 0;
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    if (trimmed.startsWith("/")) {
      return absoluteSuapUrl(trimmed);
    }
    return void 0;
  }
  function suapDiariosUrl() {
    return "https://suap.ifrn.edu.br/edu/meus_diarios/";
  }
  function activityFromMaterial(material) {
    return {
      id: material.id,
      name: material.descricao || "Material",
      modname: "resource",
      completion: false,
      url: absoluteSuapUrl(material.url)
    };
  }
  function activityFromTrabalho(trabalho) {
    return {
      id: trabalho.id,
      name: trabalho.titulo || trabalho.descricao || "Trabalho",
      modname: "assign",
      completion: Boolean(trabalho.expirado) ? false : void 0,
      url: absoluteSuapUrl(trabalho.url)
    };
  }
  function displayName(eu) {
    return eu.nome_exibicao || eu.show_name || eu.nome_usual || eu.nome_social || eu.nome_registro || eu.nome || eu.identificacao || "Usu\xE1rio SUAP";
  }
  function roleFromTipo(tipo) {
    const value = (tipo || "").toLowerCase();
    if (value.includes("servidor") || value.includes("professor") || value.includes("docente")) {
      return "coordenador";
    }
    return "estudante";
  }
  function latestPeriod(periods) {
    if (!periods.length) {
      return null;
    }
    return periods.reduce((best, current) => {
      if (current.ano_letivo > best.ano_letivo || current.ano_letivo === best.ano_letivo && current.periodo_letivo > best.periodo_letivo) {
        return current;
      }
      return best;
    });
  }
  function progressFromDisciplina(disciplina) {
    if (!disciplina) {
      return null;
    }
    const total = Number(disciplina.ch_total_aula || 0);
    const done = Number(disciplina.ch_cumprida_aula || 0);
    if (total > 0) {
      return Math.max(0, Math.min(100, Math.round(done / total * 100)));
    }
    if (typeof disciplina.frequencia === "number") {
      return Math.max(0, Math.min(100, Math.round(disciplina.frequencia)));
    }
    return null;
  }
  function mapDiarioToCourse(diario) {
    const disciplina = diario.disciplina;
    const name = diario.componente_curricular || disciplina?.descricao || disciplina?.sigla || `Di\xE1rio ${diario.id}`;
    const progress = progressFromDisciplina(disciplina);
    return {
      id: diario.id,
      name,
      fullname: name,
      shortname: disciplina?.sigla || String(diario.id),
      progress,
      hasprogress: progress != null,
      moodle: diario.ambiente_virtual || "SUAP",
      details_url: resolveExternalLink(diario.ambiente_virtual),
      is_enrolled: true,
      enrolled: true
    };
  }
  function isApiError(error) {
    return Boolean(
      error && typeof error === "object" && typeof error.status === "number"
    );
  }
  async function softGet(path) {
    try {
      return await MM.request(path, { softAuth: true });
    } catch (error) {
      if (isApiError(error) && (error.status === 404 || error.status === 403 || error.status === 400)) {
        return null;
      }
      throw error;
    }
  }
  async function fetchStudentDiarios(period) {
    const semestre = `${period.ano_letivo}.${period.periodo_letivo}`;
    const bySemestre = await softGet(`/api/ensino/diarios/${encodeURIComponent(semestre)}/`);
    if (bySemestre) {
      return asPagedResults(bySemestre);
    }
    const byPeriod = await softGet(
      `/api/ensino/meus-diarios/${period.ano_letivo}/${period.periodo_letivo}/`
    );
    if (byPeriod) {
      return asPagedResults(byPeriod);
    }
    return [];
  }
  async function fetchOpenDiarios() {
    const open = await softGet("/api/ensino/meus-diarios/");
    return open ? asPagedResults(open) : [];
  }
  async function fetchSuapDashboard() {
    const eu = await MM.request("/api/rh/eu/");
    const periodsRaw = await softGet("/api/ensino/meus-periodos-letivos/");
    const periods = periodsRaw ? asPagedResults(periodsRaw) : [];
    const period = latestPeriod(periods);
    let diarios = [];
    if (period) {
      diarios = await fetchStudentDiarios(period);
    }
    if (!diarios.length) {
      diarios = await fetchOpenDiarios();
    }
    const courses = diarios.map(mapDiarioToCourse);
    const username = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ifrn_username") || void 0 : void 0;
    return {
      nome: displayName(eu),
      username,
      foto_url: absoluteSuapUrl(eu.foto),
      foto: absoluteSuapUrl(eu.foto),
      avatar_url: absoluteSuapUrl(eu.foto),
      papel: roleFromTipo(eu.tipo_usuario),
      role: roleFromTipo(eu.tipo_usuario),
      courses,
      diarios: courses,
      autoinscricoes: [],
      self_enrolments: [],
      total_courses: courses.length,
      filtro_situacao: "inprogress",
      situacao: "inprogress"
    };
  }
  function teachersLabel(professores) {
    if (!professores || !professores.length) {
      return "Professor(a) n\xE3o informado";
    }
    return professores.map((item) => item.nome_usual || item.nome || "").filter(Boolean).join(", ") || "Professor(a) n\xE3o informado";
  }
  function sectionsFromTurma(turma) {
    const sections = [];
    const aulas = Array.isArray(turma.aulas) ? turma.aulas : [];
    const materiais = Array.isArray(turma.materiais_de_aula) ? turma.materiais_de_aula : [];
    if (aulas.length) {
      sections.push({
        name: "Aulas",
        activities: aulas.map((aula) => ({
          name: aula.conteudo || `Aula ${aula.data || ""}`.trim(),
          modname: "lesson",
          completion: false
        }))
      });
    }
    if (materiais.length) {
      sections.push({
        name: "Materiais",
        activities: materiais.map(activityFromMaterial)
      });
    }
    return sections;
  }
  async function sectionsFromDiarioEndpoints(diarioId) {
    const [aulasRaw, materiaisRaw, topicosRaw, trabalhosRaw] = await Promise.all([
      softGet(`/api/ensino/diarios/${encodeURIComponent(diarioId)}/aulas/`),
      softGet(`/api/ensino/diarios/${encodeURIComponent(diarioId)}/materiais/`),
      softGet(`/api/ensino/diarios/${encodeURIComponent(diarioId)}/topicos/`),
      softGet(`/api/ensino/diarios/${encodeURIComponent(diarioId)}/trabalhos/`)
    ]);
    const sections = [];
    const aulas = asPagedResults(aulasRaw);
    const materiais = asPagedResults(materiaisRaw);
    const topicos = asPagedResults(topicosRaw);
    const trabalhos = asPagedResults(trabalhosRaw);
    if (aulas.length) {
      sections.push({
        name: "Aulas",
        activities: aulas.map((aula) => ({
          name: aula.conteudo || `Aula ${aula.data || ""}`.trim(),
          modname: "lesson",
          completion: false
        }))
      });
    }
    if (materiais.length) {
      sections.push({
        name: "Materiais",
        activities: materiais.map(activityFromMaterial)
      });
    }
    if (trabalhos.length) {
      sections.push({
        name: "Trabalhos",
        activities: trabalhos.map(activityFromTrabalho)
      });
    }
    if (topicos.length) {
      sections.push({
        name: "T\xF3picos",
        activities: topicos.map((topico) => ({
          name: topico.titulo || topico.descricao || `T\xF3pico ${topico.id || ""}`,
          modname: "forum",
          completion: false
        }))
      });
    }
    return sections;
  }
  async function fetchSuapCourse(courseId) {
    const turma = await softGet(
      `/api/ensino/minha-turma-virtual/${encodeURIComponent(courseId)}/`
    );
    if (turma) {
      const name = turma.componente_curricular || `Di\xE1rio ${courseId}`;
      return {
        id: turma.id || Number(courseId),
        name,
        teacher: teachersLabel(turma.professores),
        workload: "",
        progress: 0,
        moodle: "SUAP",
        external_url: suapDiariosUrl(),
        summary: [
          turma.ano_letivo && turma.periodo_letivo ? `Per\xEDodo ${turma.ano_letivo}.${turma.periodo_letivo}` : ""
        ].filter(Boolean).join(" \xB7 "),
        sections: sectionsFromTurma(turma)
      };
    }
    const professoresRaw = await softGet(
      `/api/ensino/diarios/${encodeURIComponent(courseId)}/professores/`
    );
    const sections = await sectionsFromDiarioEndpoints(courseId);
    const professores = asPagedResults(professoresRaw);
    if (!sections.length && !professores.length) {
      throw new MM.ApiError(404, "Di\xE1rio n\xE3o encontrado no SUAP.");
    }
    return {
      id: Number(courseId),
      name: `Di\xE1rio ${courseId}`,
      teacher: teachersLabel(professores),
      workload: "",
      progress: 0,
      moodle: "SUAP",
      external_url: suapDiariosUrl(),
      summary: "",
      sections
    };
  }
  MM.fetchSuapDashboard = fetchSuapDashboard;
  MM.fetchSuapCourse = fetchSuapCourse;

  // src/MoodleIFRN/mobilemoodle/core_mobile/api-painel.ts
  /*!
   * api-painel.ts
   * ----------------------------------------------------------------------------
   * Consome o Painel AVA oficial (djangoapp-painel_ava):
   *   GET https://ava.ifrn.edu.br/api/v1/diarios/
   */
  var PAINEL_DASHBOARD_KEY = "ifrn_painel_dashboard";
  var PAINEL_PROFILE_KEY = "ifrn_painel_profile";
  var PAINEL_OWNER_KEY = "ifrn_painel_owner";
  var IFRN_USERNAME_KEY = "ifrn_username";
  function normalizeOwner(value) {
    return (value || "").trim().toLowerCase();
  }
  function readPainelDashboard() {
    if (hasOAuthProfileMode()) {
      return readOAuthDashboard();
    }
    const raw = sessionStorage.getItem(PAINEL_DASHBOARD_KEY);
    if (!raw) {
      return null;
    }
    const owner = normalizeOwner(sessionStorage.getItem(PAINEL_OWNER_KEY));
    const current = normalizeOwner(sessionStorage.getItem(IFRN_USERNAME_KEY));
    if (owner && current && owner !== current) {
      sessionStorage.removeItem(PAINEL_DASHBOARD_KEY);
      sessionStorage.removeItem(PAINEL_OWNER_KEY);
      sessionStorage.removeItem(PAINEL_PROFILE_KEY);
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
      return null;
    } catch {
      sessionStorage.removeItem(PAINEL_DASHBOARD_KEY);
      return null;
    }
  }
  function readPainelProfile() {
    const raw = sessionStorage.getItem(PAINEL_PROFILE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  function extractSiteUrl(viewurl) {
    if (!viewurl || !/^https?:\/\//i.test(viewurl)) {
      return void 0;
    }
    try {
      const origin = new URL(viewurl).origin;
      const host = new URL(origin).hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "10.0.2.2" || host.endsWith(".local") || host.endsWith(".localhost")) {
        return void 0;
      }
      return origin;
    } catch {
      return void 0;
    }
  }
  function diarioSuapId(diario) {
    if (typeof diario.id_diario_clean === "number") {
      return diario.id_diario_clean;
    }
    if (diario.diario?.id_clean != null) {
      return Number(diario.diario.id_clean);
    }
    const raw = diario.diario_id ?? diario.id_diario ?? diario.diario?.id;
    if (raw == null) {
      return void 0;
    }
    const asNum = Number(String(raw).replace(/^#/, ""));
    return Number.isFinite(asNum) ? asNum : void 0;
  }
  function mapPainelDiario(diario, showcase = false) {
    const courseId = Number(diario.id);
    const name = diario.fullname || diario.disciplina?.descricao || diario.shortname || `Curso ${diario.id}`;
    const viewurl = diario.viewurl || diario.url;
    const ambienteTitulo = diario.ambiente?.titulo || diario.ambiente?.label;
    const enrolled = diario.is_enrolled ?? diario.autoinscricao?.is_enrolled ?? !showcase;
    return {
      id: Number.isFinite(courseId) ? courseId : diario.id || 0,
      name,
      fullname: name,
      shortname: diario.shortname || diario.disciplina?.sigla || String(diario.id),
      progress: diario.progress ?? null,
      hasprogress: Boolean(diario.hasprogress),
      moodle: ambienteTitulo || "AVA",
      environment: ambienteTitulo,
      ambiente: diario.ambiente,
      isfavourite: Boolean(diario.isfavourite || diario.favourite),
      favourite: Boolean(diario.isfavourite || diario.favourite),
      is_enrolled: enrolled,
      enrolled,
      details_url: diario.autoinscricao?.details_url || diario.details_url || viewurl,
      viewurl,
      moodle_course_id: Number.isFinite(courseId) ? courseId : void 0,
      moodle_site_url: extractSiteUrl(viewurl),
      diario_id: diarioSuapId(diario),
      source: "painel"
    };
  }
  function usableProfilePhoto(value) {
    if (typeof value !== "string") {
      return void 0;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return void 0;
    }
    if (/^(usuário|usuario|perfil|avatar|imagem de perfil|minha foto)$/i.test(trimmed)) {
      return void 0;
    }
    if (/defaultuserpic|gravatar\.com\/avatar\//i.test(trimmed)) {
      return void 0;
    }
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
      return trimmed;
    }
    if (trimmed.startsWith("/media/") || trimmed.startsWith("/static/")) {
      return `https://suap.ifrn.edu.br${trimmed}`;
    }
    if (trimmed.startsWith("/")) {
      return `https://ava.ifrn.edu.br${trimmed}`;
    }
    return void 0;
  }
  function pickProfilePhoto(profile) {
    if (!profile) {
      return void 0;
    }
    for (const key of ["url_foto_150x200", "url_foto_75x100", "foto", "profileimageurl"]) {
      const url = usableProfilePhoto(profile[key]);
      if (url) {
        return url;
      }
    }
    return void 0;
  }
  function profileDisplayName(profile) {
    if (!profile) {
      return sessionStorage.getItem(IFRN_USERNAME_KEY) || "Usu\xE1rio";
    }
    const pick = (...keys) => {
      for (const key of keys) {
        const raw = profile[key];
        if (typeof raw !== "string") {
          continue;
        }
        let value = raw.replace(/\s+/g, " ").trim();
        if (!value || /\.\.\.$|…$/.test(value)) {
          continue;
        }
        if (/^(usuário|usuario|perfil|avatar|imagem de perfil|minha foto)$/i.test(value)) {
          continue;
        }
        if (/\b(educa[cç][aã]o|disciplina|di[aá]rio|turma|semestre|componente|curricular)\b/i.test(value)) {
          continue;
        }
        return value;
      }
      return "";
    };
    const nome = pick(
      "nome_exibicao",
      "show_name",
      "nome_usual",
      "nome_social",
      "nome_registro",
      "nome",
      "nome_completo",
      "identificacao",
      "primeiro_nome",
      "name",
      "display_name"
    );
    if (nome) {
      return nome;
    }
    return sessionStorage.getItem(IFRN_USERNAME_KEY) || "Usu\xE1rio";
  }
  async function fetchPainelDashboard() {
    const data = readPainelDashboard();
    if (!data) {
      throw new MM.ApiError(401, "Dados do Painel AVA ausentes.");
    }
    const oauth = readOAuthProfile();
    if (hasOAuthProfileMode() && !oauth) {
      throw new MM.ApiError(401, "Renove o acesso pelo SUAP. A sess\xE3o de teste expirou.");
    }
    let profile = oauth?.profile || readPainelProfile();
    if (!oauth && typeof MM.getToken === "function" && MM.getToken()) {
      try {
        const suapProfile = await MM.request("/api/rh/eu/", { softAuth: true });
        if (suapProfile && typeof suapProfile === "object" && !Array.isArray(suapProfile)) {
          profile = suapProfile;
          sessionStorage.setItem(PAINEL_PROFILE_KEY, JSON.stringify(profile));
        }
      } catch {
      }
    }
    const rawDiarios = Array.isArray(data) ? data : data.diarios || [];
    const rawCoordenacoes = Array.isArray(data) ? [] : data.coordenacoes || [];
    const rawAutoinscricoes = Array.isArray(data) ? [] : data.autoinscricoes || [];
    const diarios = rawDiarios.map((course) => mapPainelDiario(course));
    const coordenacoes = rawCoordenacoes.map((course) => mapPainelDiario(course));
    const autoinscricoes = rawAutoinscricoes.map((course) => mapPainelDiario(course, true));
    const courses = [...diarios, ...coordenacoes, ...autoinscricoes];
    console.log(`[IFRN-PANEL] dashboard local carregado; ${diarios.length} di\xE1rio(s)`);
    return {
      nome: profileDisplayName(profile),
      username: oauth?.identity || (typeof profile?.["matricula"] === "string" ? profile["matricula"] : typeof profile?.["username"] === "string" ? profile["username"] : void 0),
      foto_url: pickProfilePhoto(profile),
      papel: "estudante",
      total_courses: courses.length,
      courses,
      diarios,
      coordenacoes,
      autoinscricoes,
      source: "painel"
    };
  }
  function hasPainelSession() {
    return readPainelDashboard() !== null;
  }
  MM.fetchPainelDashboard = fetchPainelDashboard;
  MM.hasPainelSession = hasPainelSession;
  MM.getPainelToken = () => null;

  // src/MoodleIFRN/mobilemoodle/core_mobile/api.ts
  /*!
   * api.ts
   * ----------------------------------------------------------------------------
   * Fachada de dados do painel + cache em memória.
   *
   * Fonte do painel:
   *   Painel AVA (/api/v2/sala/tipo/diario/*/
  var CACHE_TTL_MS = 60 * 1e3;
  var MAX_COURSE_CACHE = 40;
  var DEMO_FORCE_500 = false;
  var dashboardCache = {
    value: null,
    fetchedAt: 0,
    inFlight: null
  };
  var courseCache = /* @__PURE__ */ new Map();
  function isCacheFresh(fetchedAt) {
    return Boolean(fetchedAt) && Date.now() - fetchedAt < CACHE_TTL_MS;
  }
  function invalidateCache() {
    dashboardCache.value = null;
    dashboardCache.fetchedAt = 0;
    dashboardCache.inFlight = null;
    courseCache.clear();
  }
  async function fetchDashboardPreferPainel() {
    if (typeof MM.hasPainelSession !== "function" || !MM.hasPainelSession()) {
      console.error("[IFRN-PANEL] sess\xE3o Painel AVA ausente \u2014 fallback SUAP desativado");
      throw new MM.ApiError(401, "Sess\xE3o do Painel AVA ausente. Entre novamente para carregar os cursos reais do Moodle.");
    }
    console.log("[IFRN-PANEL] buscando diarios no Painel AVA");
    return MM.fetchPainelDashboard();
  }
  function getDashboard(force = false) {
    if (DEMO_FORCE_500) {
      return Promise.reject(new MM.ApiError(500));
    }
    if (!force && dashboardCache.value && isCacheFresh(dashboardCache.fetchedAt)) {
      return Promise.resolve(dashboardCache.value);
    }
    if (dashboardCache.inFlight && !force) {
      return dashboardCache.inFlight;
    }
    dashboardCache.inFlight = fetchDashboardPreferPainel().then((dashboard) => {
      dashboardCache.value = dashboard;
      dashboardCache.fetchedAt = Date.now();
      return dashboard;
    }).finally(() => {
      dashboardCache.inFlight = null;
    });
    return dashboardCache.inFlight;
  }
  function pruneCourseCache() {
    if (courseCache.size <= MAX_COURSE_CACHE) {
      return;
    }
    const oldest = courseCache.keys().next().value;
    if (oldest !== void 0) {
      courseCache.delete(oldest);
    }
  }
  function enrichCourseFromDashboard(course, id) {
    const dashboard = dashboardCache.value;
    const fromList = (dashboard?.diarios || dashboard?.courses || []).find((item) => String(item.id) === id);
    if (!fromList || fromList.source !== "painel") {
      return course;
    }
    return {
      ...course,
      id: fromList.id,
      name: fromList.name || course.name,
      moodle: fromList.moodle || course.moodle,
      external_url: fromList.viewurl || fromList.details_url || course.external_url,
      moodle_course_id: fromList.moodle_course_id,
      moodle_site_url: fromList.moodle_site_url,
      source: "painel"
    };
  }
  function getCourse(courseId, force = false) {
    const id = String(courseId);
    if (!/^\d+$/.test(id)) {
      return Promise.reject(new MM.ApiError(404, "Identificador de curso inv\xE1lido."));
    }
    let entry = courseCache.get(id);
    if (!entry) {
      entry = { value: null, fetchedAt: 0, inFlight: null };
      courseCache.set(id, entry);
      pruneCourseCache();
    }
    if (!force && entry.value && isCacheFresh(entry.fetchedAt)) {
      return Promise.resolve(entry.value);
    }
    if (entry.inFlight && !force) {
      return entry.inFlight;
    }
    const fromPainel = (dashboardCache.value?.diarios || dashboardCache.value?.courses || []).find((item) => String(item.id) === id && item.source === "painel");
    if (fromPainel) {
      const course = {
        id: fromPainel.id,
        name: fromPainel.name,
        moodle: fromPainel.moodle,
        progress: fromPainel.progress ?? void 0,
        external_url: fromPainel.viewurl || fromPainel.details_url,
        moodle_course_id: fromPainel.moodle_course_id,
        moodle_site_url: fromPainel.moodle_site_url,
        source: "painel",
        sections: [],
        summary: "Toque no card do curso para abrir o conte\xFAdo nativo do Moodle Mobile."
      };
      entry.value = course;
      entry.fetchedAt = Date.now();
      return Promise.resolve(course);
    }
    entry.inFlight = MM.fetchSuapCourse(id).then((course) => {
      const enriched = enrichCourseFromDashboard(course, id);
      entry.value = enriched;
      entry.fetchedAt = Date.now();
      return enriched;
    }).finally(() => {
      entry.inFlight = null;
    });
    return entry.inFlight;
  }
  async function getCoursesList() {
    const dashboard = await getDashboard(false);
    return dashboard && dashboard.courses || [];
  }
  MM.invalidateCache = invalidateCache;
  MM.getDashboard = getDashboard;
  MM.getCourse = getCourse;
  MM.getCoursesList = getCoursesList;
  window.MobileMoodleApi = {
    setApiBaseUrl: MM.setApiBaseUrl,
    getToken: MM.getToken,
    setToken: MM.setToken,
    clearToken: MM.clearToken,
    invalidateCache,
    getCoursesList,
    getDashboard,
    getCourse
  };

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-utils.ts
  /*!
   * app-utils.ts
   * ----------------------------------------------------------------------------
   * Utilitários de UI compartilhados pelo App:
   * - descobrir pasta dos assets (logo, pages/*.html)
   * - escapeHtml / iniciais do nome
   * - clonar <template id="tpl-…">
   * - fetchText de partials HTML
   * - URL de volta ao login IFRN
   */
  function resolveAssetBase() {
    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i -= 1) {
      const src = scripts[i].src || "";
      if (src.indexOf("/mobilemoodle.js") !== -1) {
        return src.replace(/\/mobilemoodle\.js(?:\?.*)?$/i, "/");
      }
    }
    try {
      return new URL("./", window.location.href).href;
    } catch {
      return "/mobilemoodle/";
    }
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function initials(name) {
    const letters = String(name || "U").trim().charAt(0).toUpperCase();
    return letters || "U";
  }
  function cloneTemplate(id) {
    const tpl = document.getElementById(id);
    if (!tpl) {
      return null;
    }
    return tpl.content.cloneNode(true);
  }
  async function fetchText(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      controller.abort();
    }, 1e4);
    try {
      const response = await fetch(url, {
        credentials: "omit",
        cache: "no-cache",
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error("Falha ao carregar interface (" + response.status + ").");
      }
      return response.text();
    } finally {
      window.clearTimeout(timer);
    }
  }
  function resolveIonicAppUrl(routePath) {
    const path = routePath.startsWith("/") ? routePath : `/${routePath}`;
    try {
      const url = new URL(`..${path}`, App.ASSET_BASE || window.location.href);
      url.hash = "";
      url.search = "";
      return url.toString();
    } catch {
      return path;
    }
  }
  function resolveLoginUrl() {
    return resolveIonicAppUrl("/login/marketplace-ifrn");
  }
  function resolvePainelEnrolUrl(courseId, ambienteId = 2) {
    const id = Number(courseId);
    const envId = Number(ambienteId);
    if (Number.isFinite(id) && id > 0 && Number.isFinite(envId) && envId > 0) {
      sessionStorage.setItem(
        "ifrn_painel_pending_enrol",
        JSON.stringify({ courseId: id, ambienteId: envId })
      );
    }
    return resolveIonicAppUrl("/login/painel-enrol");
  }
  function resolveMoodleOpenUrl(courseId, courseName, siteUrl) {
    const id = Number(courseId);
    if (Number.isFinite(id) && id > 0) {
      try {
        console.log("[IFRN-COURSE] courseId recebido do Painel =", id);
        sessionStorage.setItem(
          "ifrn_moodle_pending_open_course",
          JSON.stringify({
            courseId: id,
            courseName: courseName || void 0,
            siteUrl: siteUrl || void 0
          })
        );
        if (siteUrl && /^https:\/\//i.test(siteUrl)) {
          sessionStorage.setItem("ifrn_moodle_last_site_url", new URL(siteUrl).origin);
        }
      } catch {
      }
    }
    return resolveIonicAppUrl("/login/moodle-open-course");
  }
  function openMoodleCourse(courseId, courseName, siteUrl) {
    const id = Number(courseId);
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }
    const bridge = window.parent?.MoodleIfrnBridge;
    if (window.parent && window.parent !== window) {
      if (bridge?.openCourse) {
        bridge.openCourse(id, courseName, siteUrl);
      } else {
        window.parent.postMessage({ type: "MOODLE_IFRN_OPEN_COURSE", courseId: id, courseName, siteUrl }, "*");
      }
      return;
    }
    try {
      console.log("[IFRN-COURSE] courseId recebido do Painel =", id);
      sessionStorage.setItem(
        "ifrn_moodle_pending_open_course",
        JSON.stringify({
          courseId: id,
          courseName: courseName || void 0,
          siteUrl: siteUrl || void 0
        })
      );
      if (siteUrl && /^https:\/\//i.test(siteUrl)) {
        sessionStorage.setItem("ifrn_moodle_last_site_url", new URL(siteUrl).origin);
      }
    } catch {
    }
    window.location.assign(resolveMoodleOpenUrl(id, courseName, siteUrl));
  }
  function openPainelEnrol(courseId, ambienteId = 2) {
    const id = Number(courseId);
    const envId = Number(ambienteId);
    if (Number.isFinite(id) && id > 0 && Number.isFinite(envId) && envId > 0) {
      try {
        sessionStorage.setItem(
          "ifrn_painel_pending_enrol",
          JSON.stringify({ courseId: id, ambienteId: envId })
        );
      } catch {
      }
    }
    const bridge = window.parent?.MoodleIfrnBridge;
    if (window.parent && window.parent !== window && bridge?.openEnrol) {
      bridge.openEnrol(id, envId);
      return;
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: "MOODLE_IFRN_OPEN_ENROL",
        courseId: id,
        ambienteId: envId
      }, "*");
      return;
    }
    window.location.assign(resolvePainelEnrolUrl(id, envId));
  }
  App.ASSET_BASE = resolveAssetBase();
  App.resolveLoginUrl = resolveLoginUrl;
  App.resolvePainelEnrolUrl = resolvePainelEnrolUrl;
  App.resolveMoodleOpenUrl = resolveMoodleOpenUrl;
  App.openMoodleCourse = openMoodleCourse;
  App.openPainelEnrol = openPainelEnrol;
  App.escapeHtml = escapeHtml;
  App.initials = initials;
  App.cloneTemplate = cloneTemplate;
  App.fetchText = fetchText;

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-status.ts
  /*!
   * app-status.ts
   * ----------------------------------------------------------------------------
   * Estados visuais enquanto a rota carrega ou falha:
   * - splash / loading enquanto os dados são carregados
   * - not found (hash inválido)
   * - erro HTTP / rede (template tpl-error-page ou fallback simples)
   */
  var SPLASH_GAUGE_SVG = '<div class="ava-splash__gauge" aria-hidden="true"><svg class="ava-splash__gauge-svg" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="ava-splash-gauge-grad" gradientUnits="userSpaceOnUse" x1="60" y1="6" x2="60" y2="114"><stop offset="0%" stop-color="#61c924"></stop><stop offset="55%" stop-color="#098e95"></stop><stop offset="100%" stop-color="#0b6064"></stop></linearGradient></defs><circle class="ava-splash__gauge-track" cx="60" cy="60" r="54"></circle><circle class="ava-splash__gauge-arc" cx="60" cy="60" r="54"></circle></svg></div>';
  function buildSplashBrand(logoSrc) {
    return '<div class="ava-splash__brand">' + SPLASH_GAUGE_SVG + '<img class="ava-splash__logo" src="' + logoSrc + '" alt="Painel AVA"></div>';
  }
  function showLoading(message) {
    const logoSrc = (App.ASSET_BASE || "") + "static/theme/ifrn/img/splash-logo.png";
    if (!App.content) {
      return;
    }
    App.content.innerHTML = '<div class="ava-splash page-loading" role="status" aria-live="polite">' + buildSplashBrand(logoSrc) + '<p class="ava-splash__text">' + App.escapeHtml(message || "Carregando...") + "</p></div>";
  }
  function bindRetry(button) {
    if (!button) {
      return;
    }
    button.addEventListener("click", () => {
      App.loadRoute?.(true);
    });
  }
  function showErrorFallback(message, canRetry) {
    if (!App.content) {
      return;
    }
    App.content.innerHTML = '<div class="page-error"><h3>N\xE3o foi poss\xEDvel abrir o painel</h3><p>' + App.escapeHtml(message) + "</p>" + (canRetry ? '<ion-button id="retry-load" color="primary">Tentar novamente</ion-button>' : "") + "</div>";
    bindRetry(document.getElementById("retry-load"));
  }
  function showNotFound() {
    if (App.title) {
      App.title.textContent = "N\xE3o encontrada";
    }
    if (App.subtitle) {
      App.subtitle.textContent = "Painel AVA";
      App.subtitle.hidden = false;
    }
    const page = App.cloneTemplate?.("tpl-not-found");
    if (!page || !App.content) {
      showErrorFallback("O endere\xE7o que voc\xEA tentou abrir n\xE3o existe ou foi removido.", false);
      return;
    }
    App.content.innerHTML = "";
    App.content.appendChild(page);
  }
  function showStatusError(error) {
    const err = error;
    const status = err && typeof err.status === "number" ? err.status : 0;
    const message = err && err.message || "Erro inesperado.";
    const errorTitle = err && err.title || "Algo deu errado";
    const canRetry = err && typeof err.retryable === "boolean" ? err.retryable : status === 0 || status === 408 || status >= 500;
    if (status === 404) {
      showNotFound();
      return;
    }
    const page = App.cloneTemplate?.("tpl-error-page");
    if (!page || !App.content) {
      showErrorFallback(message, canRetry);
      return;
    }
    if (App.title) {
      App.title.textContent = errorTitle;
    }
    if (App.subtitle) {
      App.subtitle.textContent = "Painel AVA";
      App.subtitle.hidden = false;
    }
    App.content.innerHTML = "";
    App.content.appendChild(page);
    const codeEl = document.getElementById("status-code");
    const titleEl = document.getElementById("status-title");
    const messageEl = document.getElementById("status-message");
    const actionsEl = document.getElementById("status-actions");
    if (codeEl) {
      codeEl.textContent = status > 0 ? String(status) : "!";
    }
    if (titleEl) {
      titleEl.textContent = errorTitle;
    }
    if (messageEl) {
      messageEl.textContent = message;
    }
    if (actionsEl) {
      actionsEl.innerHTML = "";
      if (canRetry) {
        const retry = document.createElement("ion-button");
        retry.id = "retry-load";
        retry.setAttribute("color", "primary");
        retry.textContent = "Tentar novamente";
        actionsEl.appendChild(retry);
        bindRetry(retry);
      }
      if (status === 401 || status === 403) {
        const login = document.createElement("ion-button");
        login.setAttribute("color", "primary");
        login.textContent = "Ir para o login";
        login.addEventListener("click", () => {
          if (typeof App.logout === "function") {
            App.logout();
          } else {
            window.location.replace("/login/marketplace-ifrn");
          }
        });
        actionsEl.appendChild(login);
      } else {
        const home = document.createElement("ion-button");
        home.setAttribute("fill", "clear");
        home.setAttribute("color", "primary");
        home.setAttribute("href", "#/painel");
        home.textContent = "Voltar ao painel";
        actionsEl.appendChild(home);
      }
    }
  }
  App.showLoading = showLoading;
  App.showNotFound = showNotFound;
  App.showStatusError = showStatusError;

  // src/MoodleIFRN/mobilemoodle/core_mobile/course-favourites.ts
  var PREFIX = "ifrn_course_favourites_v1:";
  function currentOwner() {
    return (sessionStorage.getItem("ifrn_username") || "").trim().toLowerCase();
  }
  function favouriteCourseKey(course) {
    const id = Number(course.moodle_course_id ?? (course.source === "painel" ? course.id : NaN));
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    for (const candidate of [course.moodle_site_url, course.viewurl, course.details_url]) {
      if (!candidate) continue;
      try {
        const url = new URL(candidate);
        if (url.protocol !== "https:" && url.protocol !== "http:") continue;
        const sitePath = url.pathname.split("/course/")[0].replace(/\/+$/, "");
        return JSON.stringify([url.origin + sitePath, id]);
      } catch {
      }
    }
    if (course.ambiente?.id != null) {
      return JSON.stringify(["painel-ambiente:" + course.ambiente.id, id]);
    }
    return null;
  }
  function createCourseFavourites() {
    const owner = currentOwner();
    const storageKey = PREFIX + encodeURIComponent(owner);
    let values = /* @__PURE__ */ Object.create(null);
    if (owner) {
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === "boolean") values[key] = value;
          }
        }
      } catch {
      }
    }
    const canEdit = (course) => !!owner && currentOwner() === owner && favouriteCourseKey(course) !== null;
    const isFavourite = (course) => {
      if (!owner || currentOwner() !== owner) return false;
      const key = favouriteCourseKey(course);
      if (key && typeof values[key] === "boolean") return values[key];
      return course.isfavourite === true || course.favourite === true;
    };
    const toggle = (course) => {
      const key = favouriteCourseKey(course);
      if (!key || !canEdit(course)) throw new Error("N\xE3o foi poss\xEDvel identificar a conta ou o ambiente deste curso.");
      const next = !isFavourite(course);
      const updated = { ...values, [key]: next };
      localStorage.setItem(storageKey, JSON.stringify(updated));
      values = updated;
      return next;
    };
    return { canEdit, isFavourite, toggle };
  }

  // src/MoodleIFRN/mobilemoodle/core_mobile/course-target.ts
  function resolveCourseSite(course) {
    const environment = [course.environment, course.moodle, course.ambiente?.titulo].filter(Boolean).join(" ");
    const expected = /presencial/i.test(environment) ? "https://presencial.ava.ifrn.edu.br" : /acad[eê]mico/i.test(environment) ? "https://academico.ava.ifrn.edu.br" : void 0;
    const raw = course.moodle_site_url || course.viewurl || course.details_url;
    if (raw) {
      try {
        const url = new URL(raw);
        if (url.protocol !== "https:" || url.username || url.password || !url.hostname.endsWith(".ava.ifrn.edu.br")) {
          return void 0;
        }
        if (expected && url.origin !== expected) {
          return void 0;
        }
        return url.origin;
      } catch {
        return void 0;
      }
    }
    return expected;
  }

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-views.ts
  /*!
   * app-views.ts
   * ----------------------------------------------------------------------------
   * Monta o HTML das telas principais a partir dos <template>:
   *
   *   renderPainel(dashboard) → abas Diários / Autoinscrição + cards
   *   renderCurso(course, dashboard) → cabeçalho + seções expansíveis + atividades
   *
   * Também atualiza header (título/subtítulo) e dados do usuário na sidebar.
   */
  var favourites;
  var currentLists;
  var ACTIVITY_ICONS = {
    assign: "create-outline",
    forum: "chatbubbles-outline",
    quiz: "help-circle-outline",
    resource: "document-text-outline",
    url: "link-outline",
    page: "document-outline",
    folder: "folder-outline",
    book: "book-outline",
    label: "pricetag-outline",
    lesson: "school-outline",
    scorm: "cube-outline",
    h5pactivity: "game-controller-outline",
    workshop: "people-outline",
    choice: "list-outline",
    feedback: "chatbox-ellipses-outline",
    glossary: "library-outline",
    wiki: "globe-outline",
    data: "server-outline",
    chat: "chatbubble-outline",
    bigbluebuttonbn: "videocam-outline",
    attendance: "checkmark-done-outline"
  };
  var TAB_META = {
    diarios: {
      title: "Meus Di\xE1rios",
      empty: "\xC9 poss\xEDvel que a Secretaria Acad\xEAmica ainda n\xE3o tenha lhe inserido em di\xE1rio algum; neste caso, aguarde."
    },
    coordenacoes: {
      title: "Salas de Coordena\xE7\xE3o",
      empty: "N\xE3o h\xE1 salas de coordena\xE7\xE3o dispon\xEDveis para este usu\xE1rio."
    },
    autoinscricoes: {
      title: "Cursos com Autoinscri\xE7\xE3o",
      empty: "N\xE3o h\xE1 cursos com autoinscri\xE7\xE3o dispon\xEDveis no momento. Ajuste os filtros ou volte mais tarde."
    }
  };
  function setUser(dashboard) {
    const nome = dashboard.nome || "Estudante";
    const letter = App.initials(nome);
    const foto = dashboard.foto_url || dashboard.foto || dashboard.avatar_url || "";
    App.sidebarUserName = nome;
    if (App.toolbarAvatar) {
      App.toolbarAvatar.textContent = letter;
      App.toolbarAvatar.setAttribute("aria-label", "Abrir perfil de " + nome);
    }
    const nameEl = document.getElementById("sidebar-user-name");
    if (nameEl) {
      nameEl.textContent = nome;
    }
    if (App.menuUserInfo && App.menuUserInfo !== nameEl) {
      App.menuUserInfo.textContent = nome;
    }
    const profileBtn = document.getElementById("btn-toggle-profile");
    if (profileBtn) {
      let avatar = document.getElementById("menu-user-avatar");
      if (foto) {
        if (!avatar || avatar.tagName !== "IMG") {
          const img = document.createElement("img");
          img.id = "menu-user-avatar";
          img.className = "profile-image";
          img.alt = "Imagem de perfil";
          if (avatar) {
            avatar.replaceWith(img);
          } else {
            profileBtn.insertBefore(img, profileBtn.firstChild);
          }
          avatar = img;
        }
        avatar.src = foto;
      } else {
        if (!avatar || avatar.tagName === "IMG") {
          const div = document.createElement("div");
          div.id = "menu-user-avatar";
          div.className = "profile-image profile-image--initials";
          div.setAttribute("aria-hidden", "true");
          if (avatar) {
            avatar.replaceWith(div);
          } else {
            profileBtn.insertBefore(div, profileBtn.firstChild);
          }
          avatar = div;
        }
        avatar.className = "profile-image profile-image--initials";
        avatar.textContent = letter;
      }
    }
    if (typeof App.applyUserFilter === "function") {
      App.applyUserFilter(dashboard);
    }
  }
  function getPainelLists(dashboard) {
    const diarios = dashboard.diarios || dashboard.courses || [];
    const coordenacoes = dashboard.coordenacoes || [];
    const autoinscricoes = dashboard.autoinscricoes || dashboard.self_enrolments || [];
    return {
      diarios: Array.isArray(diarios) ? diarios : [],
      coordenacoes: Array.isArray(coordenacoes) ? coordenacoes : [],
      autoinscricoes: Array.isArray(autoinscricoes) ? autoinscricoes : []
    };
  }
  function itemName(item) {
    return item.name || item.fullname || "Curso " + (item.id || "");
  }
  function itemEnv(item) {
    return item.moodle || item.environment || item.ambiente && item.ambiente.titulo || "AVA Acad\xEAmico";
  }
  function buildCourseCard(course) {
    const fragment = App.cloneTemplate("tpl-painel-card");
    if (!fragment) {
      return document.createTextNode("");
    }
    const link = fragment.querySelector(".painel-card-link");
    const cardTitle = fragment.querySelector(".painel-card-title");
    const shortname = fragment.querySelector(".painel-card-header-shortname");
    const env = fragment.querySelector(".painel-card-header-env");
    const favBtn = fragment.querySelector(".painel-card-details-info-favourite");
    if (link) {
      wireCourseCardOpen(link, course);
    }
    if (cardTitle) {
      cardTitle.textContent = itemName(course);
    }
    if (shortname) {
      shortname.textContent = course.shortname || itemName(course);
    }
    if (env) {
      env.textContent = itemEnv(course);
    }
    if (favBtn) bindFavourite(favBtn, course);
    return fragment;
  }
  function bindFavourite(button, course) {
    const key = favouriteCourseKey(course);
    const update = (target, active) => {
      target.classList.toggle("painel-card-details-info-favourite", !active);
      target.classList.toggle("painel-card-details-info-unfavourite", active);
      target.setAttribute("aria-pressed", String(active));
      target.setAttribute("aria-label", (active ? "Remover dos favoritos: " : "Adicionar aos favoritos: ") + itemName(course));
      target.querySelector("ion-icon")?.setAttribute("name", active ? "star" : "star-outline");
    };
    button.dataset.favouriteKey = key || "";
    button.disabled = !favourites.canEdit(course);
    button.title = button.disabled ? "Conta ou ambiente do curso n\xE3o identificado" : "Favorito salvo neste aparelho";
    update(button, favourites.isFavourite(course));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        const active = favourites.toggle(course);
        if (App.activeFilter?.situacao === "favourites") {
          const host = document.getElementById("painel-cards");
          if (host) renderTabCards(host, App.activePainelTab || "diarios", currentLists);
        } else {
          document.querySelectorAll("[data-favourite-key]").forEach((target) => {
            if (target.dataset.favouriteKey === key) update(target, active);
          });
        }
      } catch {
        window.alert("N\xE3o foi poss\xEDvel salvar o favorito neste aparelho. Tente novamente.");
      }
    });
  }
  function siteUrlFromCourse(course) {
    return resolveCourseSite(course);
  }
  function wireCourseCardOpen(link, course) {
    const moodleCourseId = course.moodle_course_id ?? (course.source === "painel" ? Number(course.id) : NaN);
    const moodleSiteUrl = siteUrlFromCourse(course);
    link.href = "#";
    link.setAttribute("role", "button");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!moodleSiteUrl) {
        window.alert("N\xE3o foi poss\xEDvel confirmar o ambiente deste curso. Atualize o Painel e tente novamente.");
        return;
      }
      console.log("[IFRN-COURSE] card-click");
      if (!Number.isFinite(moodleCourseId) || moodleCourseId <= 0) {
        console.warn(
          "[IFRN-COURSE] card sem moodle_course_id \u2014 n\xE3o abre detalhe SPA",
          { id: course.id, source: course.source }
        );
        return;
      }
      if (typeof App.openMoodleCourse === "function") {
        App.openMoodleCourse(
          moodleCourseId,
          course.name || course.fullname,
          moodleSiteUrl
        );
        return;
      }
      if (typeof App.resolveMoodleOpenUrl !== "function") {
        console.warn("[IFRN-COURSE] resolveMoodleOpenUrl ausente no bundle");
        return;
      }
      console.log("[IFRN-COURSE] courseId recebido do Painel =", moodleCourseId);
      console.log("[IFRN-COURSE] leaving-mobilemoodle");
      window.location.assign(
        App.resolveMoodleOpenUrl(
          moodleCourseId,
          course.name || course.fullname,
          moodleSiteUrl
        )
      );
    });
  }
  function buildAutoinscricaoCard(course) {
    const fragment = App.cloneTemplate("tpl-painel-card-autoinscricao");
    if (!fragment) {
      return document.createTextNode("");
    }
    const enrolled = Boolean(course.is_enrolled || course.enrolled);
    const link = fragment.querySelector(".painel-card-link");
    const cardTitle = fragment.querySelector(".painel-card-title");
    const shortname = fragment.querySelector(".painel-card-header-shortname");
    const env = fragment.querySelector(".painel-card-header-env");
    const enrolledBadge = fragment.querySelector(".painel-card-info-enrolled");
    const btnEnroll = fragment.querySelector(".btn-enroll");
    const btnAccess = fragment.querySelector(".btn-access");
    const btnUnenroll = fragment.querySelector(".btn-unenroll");
    const favouriteButton = fragment.querySelector("[data-course-favourite]");
    if (favouriteButton) bindFavourite(favouriteButton, course);
    if (link) {
      wireCourseCardOpen(link, course);
    }
    if (cardTitle) {
      cardTitle.textContent = itemName(course);
    }
    if (shortname) {
      shortname.textContent = course.shortname || itemName(course);
    }
    if (env) {
      env.textContent = itemEnv(course);
    }
    if (enrolledBadge) {
      enrolledBadge.hidden = !enrolled;
    }
    if (btnEnroll) {
      btnEnroll.hidden = enrolled;
      btnEnroll.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const courseId = course.moodle_course_id ?? (course.source === "painel" ? Number(course.id) : NaN);
        const ambienteId = Number(course.ambiente?.id || 2);
        if (!Number.isFinite(courseId) || courseId <= 0 || typeof App.resolvePainelEnrolUrl !== "function") {
          window.alert("N\xE3o foi poss\xEDvel identificar este curso para autoinscri\xE7\xE3o.");
          return;
        }
        if (typeof App.openPainelEnrol === "function") {
          App.openPainelEnrol(courseId, ambienteId);
          return;
        }
        window.location.assign(App.resolvePainelEnrolUrl(courseId, ambienteId));
      });
    }
    if (btnAccess) {
      btnAccess.hidden = !enrolled;
      btnAccess.removeAttribute("href");
      btnAccess.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        console.log("[IFRN-COURSE] card-click");
        const moodleCourseId = course.moodle_course_id ?? (course.source === "painel" ? Number(course.id) : NaN);
        const moodleSiteUrl = siteUrlFromCourse(course);
        if (!moodleSiteUrl) {
          window.alert("N\xE3o foi poss\xEDvel confirmar o ambiente deste curso. Atualize o Painel e tente novamente.");
          return;
        }
        if (!Number.isFinite(moodleCourseId) || moodleCourseId <= 0) {
          return;
        }
        if (typeof App.openMoodleCourse === "function") {
          App.openMoodleCourse(
            moodleCourseId,
            course.name || course.fullname,
            moodleSiteUrl
          );
          return;
        }
        if (typeof App.resolveMoodleOpenUrl !== "function") {
          return;
        }
        console.log("[IFRN-COURSE] leaving-mobilemoodle");
        window.location.assign(
          App.resolveMoodleOpenUrl(
            moodleCourseId,
            course.name || course.fullname,
            moodleSiteUrl
          )
        );
      });
    }
    if (btnUnenroll) {
      btnUnenroll.hidden = !enrolled;
      btnUnenroll.addEventListener("click", () => {
        window.alert(
          "O cancelamento de inscri\xE7\xE3o ser\xE1 liberado com a API de autoinscri\xE7\xE3o."
        );
      });
    }
    return fragment;
  }
  function renderEmpty(host, tabKey) {
    const empty = App.cloneTemplate("tpl-empty-cursos");
    if (!empty) {
      return;
    }
    const hint = empty.querySelector(".no-data__hint");
    const meta = TAB_META[tabKey] || TAB_META.diarios;
    if (hint) {
      hint.textContent = App.activeFilter?.situacao === "favourites" ? "Nenhum favorito nesta aba. Marque a estrela de um curso para encontr\xE1-lo aqui." : meta.empty;
    }
    host.appendChild(empty);
  }
  function renderTabCards(host, tabKey, lists) {
    const allItems = tabKey === "autoinscricoes" ? lists.autoinscricoes : tabKey === "coordenacoes" ? lists.coordenacoes : lists.diarios;
    const items = App.activeFilter?.situacao === "favourites" ? allItems.filter((course) => favourites.isFavourite(course)) : allItems;
    host.innerHTML = "";
    host.setAttribute("data-active-tab", tabKey);
    if (!items.length) {
      renderEmpty(host, tabKey);
      return;
    }
    const batch = document.createDocumentFragment();
    items.forEach((item) => {
      if (tabKey === "autoinscricoes") {
        batch.appendChild(buildAutoinscricaoCard(item));
      } else {
        batch.appendChild(buildCourseCard(item));
      }
    });
    host.appendChild(batch);
  }
  function updateIntro(tabKey) {
    const titleEl = document.getElementById("painel-intro-title");
    const staleIntro = document.getElementById("painel-intro-text");
    const meta = TAB_META[tabKey] || TAB_META.diarios;
    staleIntro?.remove();
    if (titleEl) {
      titleEl.textContent = meta.title;
    }
  }
  function setActiveTab(tabKey, lists) {
    const tabs = document.querySelectorAll("#painel-tabs .ava-tab");
    const cardsHost = document.getElementById("painel-cards");
    tabs.forEach((tab) => {
      const active = tab.getAttribute("data-tab") === tabKey;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    updateIntro(tabKey);
    if (cardsHost) {
      renderTabCards(cardsHost, tabKey, lists);
    }
    App.activePainelTab = tabKey;
  }
  function bindTabs(lists) {
    const tabsHost = document.getElementById("painel-tabs");
    if (!tabsHost || tabsHost.dataset.bound === "1") {
      return;
    }
    tabsHost.dataset.bound = "1";
    tabsHost.addEventListener("click", (event) => {
      const target = event.target;
      const tab = target?.closest(".ava-tab");
      if (!tab || tab.disabled) {
        return;
      }
      const key = tab.getAttribute("data-tab");
      if (!key || key === App.activePainelTab) {
        return;
      }
      setActiveTab(key, lists);
    });
  }
  function renderPainel(dashboard) {
    if (App.title) {
      App.title.textContent = "Painel AVA";
    }
    if (App.subtitle) {
      App.subtitle.textContent = "Ambiente Virtual de Aprendizagem";
      App.subtitle.hidden = false;
    }
    setUser(dashboard);
    const lists = getPainelLists(dashboard);
    currentLists = lists;
    favourites = createCourseFavourites();
    App.onFilterChange = () => {
      const host = document.getElementById("painel-cards");
      if (host) renderTabCards(host, App.activePainelTab || "diarios", lists);
    };
    const page = App.cloneTemplate("tpl-painel");
    const initialTab = App.activePainelTab === "autoinscricoes" || App.activePainelTab === "coordenacoes" ? App.activePainelTab : "diarios";
    App.dashboardPapel = dashboard.papel || dashboard.role || "estudante";
    if (!page || !App.content) {
      return;
    }
    App.content.innerHTML = "";
    App.content.appendChild(page);
    App.updateFilterChip?.();
    bindTabs(lists);
    setActiveTab(initialTab, lists);
    const refresher = document.getElementById("painel-refresher");
    if (refresher) {
      refresher.addEventListener("ionRefresh", (event) => {
        App.loadRoute?.(true).finally(() => {
          const target = event.target;
          target.complete?.();
        });
      });
    }
  }
  function activityIcon(modname) {
    const key = String(modname || "").toLowerCase();
    return ACTIVITY_ICONS[key] || "document-text-outline";
  }
  function activityLabel(modname) {
    const key = String(modname || "").toLowerCase();
    if (!key) {
      return "Atividade";
    }
    const map = {
      assign: "Tarefa",
      forum: "F\xF3rum",
      quiz: "Question\xE1rio",
      resource: "Arquivo",
      url: "URL",
      page: "P\xE1gina",
      folder: "Pasta",
      book: "Livro",
      label: "R\xF3tulo",
      lesson: "Li\xE7\xE3o",
      scorm: "SCORM",
      h5pactivity: "H5P",
      workshop: "Workshop",
      choice: "Escolha",
      feedback: "Pesquisa",
      glossary: "Gloss\xE1rio",
      wiki: "Wiki",
      data: "Banco de dados",
      chat: "Chat",
      bigbluebuttonbn: "BigBlueButton",
      attendance: "Frequ\xEAncia"
    };
    return map[key] || key;
  }
  function buildActivity(activity) {
    const fragment = App.cloneTemplate("tpl-curso-activity");
    if (!fragment) {
      return document.createTextNode("");
    }
    const item = fragment.querySelector(".activity-item");
    const icon = fragment.querySelector(".activity-item__icon ion-icon");
    const name = fragment.querySelector(".activity-item__name");
    const mod = fragment.querySelector(".activity-item__mod");
    const status = fragment.querySelector(".activity-item__status");
    const chevron = fragment.querySelector(".activity-item__chevron");
    const modname = activity.modname || activity.module || activity.type || "";
    const url = typeof activity.url === "string" ? activity.url.trim() : "";
    if (icon) {
      icon.setAttribute("name", activityIcon(modname));
    }
    if (name) {
      name.textContent = activity.name || activity.title || "Atividade";
    }
    if (mod) {
      mod.textContent = activityLabel(modname);
    }
    if (status && typeof activity.completion === "boolean") {
      status.hidden = false;
      status.textContent = activity.completion ? "Conclu\xEDda" : "Pendente";
      status.classList.toggle("activity-item__status--pending", !activity.completion);
    }
    if (item) {
      if (url) {
        item.href = url;
        item.target = "_blank";
        item.rel = "noopener noreferrer";
        item.classList.add("activity-item--link");
        item.setAttribute(
          "aria-label",
          (activity.name || activity.title || "Atividade") + " (abrir)"
        );
        if (chevron) {
          chevron.hidden = false;
        }
      } else {
        item.removeAttribute("href");
        item.setAttribute("role", "listitem");
        item.classList.add("activity-item--static");
        item.addEventListener("click", (event) => {
          event.preventDefault();
        });
      }
    }
    return fragment;
  }
  function bindSectionToggle(article) {
    if (!article) {
      return;
    }
    const header = article.querySelector(".topic-card__header");
    if (!header) {
      return;
    }
    header.addEventListener("click", () => {
      const open = article.classList.toggle("is-open");
      header.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  function renderCurso(course, dashboard) {
    if (App.title) {
      App.title.textContent = course.name || "Curso";
    }
    if (App.subtitle) {
      App.subtitle.textContent = "Painel AVA";
      App.subtitle.hidden = false;
    }
    setUser(dashboard);
    const progress = Math.max(0, Math.min(100, Number(course.progress || 0)));
    const page = App.cloneTemplate("tpl-curso");
    if (!page || !App.content) {
      return;
    }
    App.content.innerHTML = "";
    App.content.appendChild(page);
    const breadcrumb = document.getElementById("curso-breadcrumb-name");
    const title = document.getElementById("curso-title");
    const teacher = document.getElementById("curso-teacher");
    const workload = document.getElementById("curso-workload");
    const progressText = document.getElementById("curso-progress-text");
    const progressLabel = document.getElementById("curso-progress-label");
    if (breadcrumb) {
      breadcrumb.textContent = course.name || "";
    }
    if (title) {
      title.textContent = course.name || "";
    }
    if (teacher) {
      teacher.textContent = course.teacher || "\u2014";
    }
    if (workload) {
      workload.textContent = course.workload || "\u2014";
    }
    if (progressText) {
      progressText.textContent = progress + "%";
    }
    if (progressLabel) {
      progressLabel.textContent = progress + "% conclu\xEDdo";
    }
    const envTag = document.getElementById("curso-env-tag");
    if (envTag && course.moodle) {
      envTag.textContent = course.moodle;
    }
    const courseId = course.id != null ? String(course.id) : "";
    const dashboardCourse = (dashboard.courses || dashboard.diarios || []).find(
      (item) => String(item.id) === courseId
    );
    const externalUrl = course.external_url || dashboardCourse?.viewurl || dashboardCourse?.details_url || "https://suap.ifrn.edu.br/edu/meus_diarios/";
    const openExternal = document.getElementById("curso-open-external");
    if (openExternal && externalUrl) {
      openExternal.hidden = false;
      openExternal.setAttribute("href", externalUrl);
      openExternal.setAttribute("target", "_blank");
      openExternal.setAttribute("rel", "noopener noreferrer");
    }
    const summary = course.summary || course.description || "";
    const summaryBlock = document.getElementById("curso-summary-block");
    const summaryEl = document.getElementById("curso-summary");
    if (summary && summaryBlock && summaryEl) {
      summaryEl.textContent = String(summary).replace(/<[^>]+>/g, " ").trim();
      summaryBlock.hidden = !summaryEl.textContent;
    }
    const progressBar = document.getElementById("curso-progress-bar");
    if (progressBar) {
      progressBar.value = progress / 100;
    }
    const sectionsHost = document.getElementById("curso-sections");
    const sections = course.sections || [];
    if (!sectionsHost) {
      return;
    }
    if (!sections.length) {
      sectionsHost.innerHTML = '<div class="empty-state"><p>Nenhuma se\xE7\xE3o dispon\xEDvel.</p></div>';
      return;
    }
    const batch = document.createDocumentFragment();
    sections.forEach((section, index) => {
      const item = App.cloneTemplate("tpl-curso-section");
      if (!item) {
        return;
      }
      const activities = section.activities || section.modules || section.cms || [];
      const countEl = item.querySelector(".topic-card__count");
      const list = item.querySelector(".activity-list");
      const article = item.querySelector(".topic-card");
      const topicIndex = item.querySelector(".topic-index");
      const topicName = item.querySelector(".topic-name");
      const header = item.querySelector(".topic-card__header");
      if (topicIndex) {
        topicIndex.textContent = String(index + 1);
      }
      if (topicName) {
        topicName.textContent = section.name || "T\xF3pico " + (index + 1);
      }
      const count = activities.length;
      if (countEl) {
        countEl.textContent = count === 1 ? "1 atividade" : count > 0 ? count + " atividades" : "T\xF3pico da sala virtual";
      }
      if (list) {
        if (!count) {
          const empty = document.createElement("p");
          empty.className = "activity-empty";
          empty.textContent = "Nenhuma atividade nesta se\xE7\xE3o.";
          list.appendChild(empty);
        } else {
          activities.forEach((activity) => {
            list.appendChild(buildActivity(activity));
          });
        }
      }
      if (index === 0 && article && header) {
        article.classList.add("is-open");
        header.setAttribute("aria-expanded", "true");
      }
      bindSectionToggle(article);
      batch.appendChild(item);
    });
    sectionsHost.appendChild(batch);
  }
  App.setUser = setUser;
  App.renderPainel = renderPainel;
  App.renderCurso = renderCurso;

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-router.ts
  /*!
   * app-router.ts
   * ----------------------------------------------------------------------------
   * Roteamento por hash (SPA leve, sem Angular Router).
   *
   * Rotas:
   *   #/painel          → lista de diários / autoinscrição
   *   #/curso/123       → detalhe do curso
   *   qualquer outra    → not found
   *
   * loadRoute():
   *   1. Garante templates HTML carregados
   *   2. Verifica a sessão do Painel AVA
   *   3. Mostra splash → busca API → renderPainel / renderCurso
   *
   * routeSeq evita race: se o usuário mudar o hash no meio do await,
   * a resposta antiga é ignorada.
   */
  var templatesReady = null;
  var routeSeq = 0;
  function parseRoute() {
    const hash = window.location.hash.replace(/^#/, "") || "/painel";
    const courseMatch = hash.match(/^\/curso\/(\d{1,10})$/);
    if (courseMatch) {
      return {
        name: "curso",
        courseId: Number(courseMatch[1])
      };
    }
    if (hash === "/painel" || hash === "/" || hash === "") {
      return { name: "painel" };
    }
    return { name: "notfound" };
  }
  async function loadTemplates() {
    if (templatesReady) {
      return templatesReady;
    }
    if (document.getElementById("tpl-painel") && document.getElementById("tpl-curso") && document.getElementById("tpl-error-page")) {
      templatesReady = Promise.resolve();
      return templatesReady;
    }
    const assetBase = App.ASSET_BASE || "";
    const base = assetBase.indexOf("static/theme/ifrn/") !== -1 ? assetBase.replace(/static\/theme\/ifrn\/$/, "") : assetBase;
    templatesReady = Promise.all([
      App.fetchText(base + "pages/painel.html"),
      App.fetchText(base + "pages/curso.html"),
      App.fetchText(base + "pages/erros.html")
    ]).then((parts) => {
      if (App.templatesRoot) {
        App.templatesRoot.innerHTML = parts.join("\n");
      }
    }).catch((error) => {
      templatesReady = null;
      throw error;
    });
    return templatesReady;
  }
  async function loadDashboard(force) {
    if (!force && App.dashboardCache) {
      return App.dashboardCache;
    }
    App.dashboardCache = await window.MobileMoodleApi.getDashboard(force);
    return App.dashboardCache;
  }
  async function loadRoute(force) {
    const seq = ++routeSeq;
    const route = parseRoute();
    try {
      await loadTemplates();
      if (seq !== routeSeq) {
        return;
      }
      if (route.name === "notfound") {
        App.showNotFound?.();
        return;
      }
      const hasPainelSession2 = typeof MM.hasPainelSession === "function" && MM.hasPainelSession();
      if (!hasPainelSession2 || hasOAuthProfileMode() && !readOAuthProfile()) {
        console.warn(
          "[IFRN-ROUTER] Sess\xE3o do Painel AVA n\xE3o encontrada."
        );
        App.showStatusError?.({
          status: 401,
          title: "Acesso n\xE3o autorizado",
          message: "A sess\xE3o do Painel AVA n\xE3o foi encontrada. Entre novamente pelo SUAP.",
          retryable: false
        });
        return;
      }
      console.debug(
        "[IFRN-ROUTER] Sess\xE3o do Painel AVA v\xE1lida.",
        { route: route.name }
      );
      App.showLoading?.(
        route.name === "curso" ? "Carregando curso..." : "Carregando painel..."
      );
      if (route.name === "curso") {
        const dashboard2 = await loadDashboard(force);
        const course = await window.MobileMoodleApi.getCourse(route.courseId, force);
        if (seq !== routeSeq) {
          return;
        }
        App.renderCurso?.(course, dashboard2);
        return;
      }
      if (force) {
        App.dashboardCache = null;
        window.MobileMoodleApi.invalidateCache();
      }
      const dashboard = await loadDashboard(force);
      if (seq !== routeSeq) {
        return;
      }
      App.renderPainel?.(dashboard);
    } catch (error) {
      if (seq !== routeSeq) {
        return;
      }
      console.error(
        "[IFRN-ROUTER] Erro ao carregar rota.",
        error
      );
      App.showStatusError?.(error);
    }
  }
  App.parseRoute = parseRoute;
  App.loadRoute = loadRoute;

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-accessibility.ts
  /*!
   * app-accessibility.ts
   * ----------------------------------------------------------------------------
   * Preferências de acessibilidade espelhando o Painel AVA / theme_ifrn25.
   *
   * Estado em localStorage (chave ifrn_a11y_prefs).
   * applyToBody() aplica classes CSS no <body> (ex.: color_mode_high_contrast).
   * VLibras é carregado sob demanda quando vlibras_active = true.
   */
  var STORAGE_KEY = "ifrn_a11y_prefs";
  var BOOL_KEYS = [
    "dyslexia_friendly",
    "highlight_links",
    "stop_animations",
    "hidden_illustrative_image",
    "big_cursor",
    "vlibras_active",
    "high_line_height"
  ];
  var ZOOM_OPTIONS = [100, 120, 130, 150, 160];
  var COLOR_MODE_OPTIONS = ["default", "high_contrast", "low_contrast", "colorblind", "grayscale"];
  var COLOR_MODE_LABELS = {
    default: "Padr\xE3o",
    high_contrast: "Alto contraste",
    low_contrast: "Contraste reduzido",
    colorblind: "Amig\xE1vel a dalt\xF4nicos",
    grayscale: "Escala de cinza"
  };
  var state = {
    dyslexia_friendly: false,
    remove_justify: false,
    highlight_links: false,
    stop_animations: false,
    hidden_illustrative_image: false,
    big_cursor: false,
    vlibras_active: false,
    high_line_height: false,
    zoom_level: 100,
    color_mode: "default"
  };
  var vlibrasReady = false;
  function getEl(id) {
    return document.getElementById(id);
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const saved = JSON.parse(raw);
      BOOL_KEYS.forEach((key) => {
        if (typeof saved[key] === "boolean") {
          state[key] = saved[key];
        }
      });
      if (ZOOM_OPTIONS.indexOf(Number(saved.zoom_level)) !== -1) {
        state.zoom_level = Number(saved.zoom_level);
      }
      if (saved.color_mode && COLOR_MODE_OPTIONS.indexOf(saved.color_mode) !== -1) {
        state.color_mode = saved.color_mode;
      }
    } catch {
    }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
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
      root.innerHTML = '<div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
      document.body.appendChild(root);
    }
    if (window.VLibras?.Widget) {
      try {
        new window.VLibras.Widget("https://vlibras.gov.br/app");
        vlibrasReady = true;
      } catch {
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
    script.onload = () => {
      try {
        new window.VLibras.Widget("https://vlibras.gov.br/app");
        vlibrasReady = true;
      } catch {
        vlibrasReady = true;
      }
    };
    document.body.appendChild(script);
  }
  function applyToBody() {
    const body = document.body;
    BOOL_KEYS.forEach((key) => {
      body.classList.toggle(key, !!state[key]);
    });
    body.classList.remove("remove_justify");
    COLOR_MODE_OPTIONS.forEach((mode) => {
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
      ZOOM_OPTIONS.filter((level) => level > 100).forEach((level) => {
        const span = document.createElement("span");
        span.className = "cycle-indicator" + (level <= state.zoom_level ? " active" : "");
        container.appendChild(span);
      });
      return;
    }
    COLOR_MODE_OPTIONS.filter((m) => m !== "default").forEach((m) => {
      const span = document.createElement("span");
      span.className = "cycle-indicator" + (m === state.color_mode ? " active" : "");
      container.appendChild(span);
    });
  }
  function syncPanelControls() {
    BOOL_KEYS.forEach((key) => {
      const el = document.getElementById(key);
      if (el && el.type === "checkbox") {
        el.checked = !!state[key];
      }
    });
    const zoomWrap = getEl("selector-cycle-access");
    const zoomValue = getEl("zoom-value");
    const zoomIndicators = getEl("cycle-indicators");
    const colorWrap = getEl("selector-cycle-color");
    const colorLabel = getEl("color-mode-label");
    const colorIndicators = getEl("color-indicators");
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
      colorLabel.textContent = COLOR_MODE_LABELS[state.color_mode] || "Padr\xE3o";
    }
    renderIndicators(colorIndicators, "color");
  }
  function bindPanelControls() {
    BOOL_KEYS.forEach((key) => {
      const el = document.getElementById(key);
      if (!el) {
        return;
      }
      el.checked = !!state[key];
      el.addEventListener("change", () => {
        setBool(key, el.checked);
      });
    });
    const zoomBtn = getEl("cycle-toggle");
    const colorBtn = getEl("color-mode-toggle");
    if (zoomBtn) {
      zoomBtn.addEventListener("click", (event) => {
        event.preventDefault();
        cycleZoom();
      });
    }
    if (colorBtn) {
      colorBtn.addEventListener("click", (event) => {
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
    init,
    bindPanel: bindPanelControls,
    syncPanel: syncPanelControls,
    getState: () => Object.assign({}, state),
    COLOR_MODE_LABELS
  };

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-sidebar.ts
  /*!
   * app-sidebar.ts
   * ----------------------------------------------------------------------------
   * Cabeçalho IFRN26 + painéis laterais (perfil, ajuda, acessibilidade, filtros).
   *
   * openModal(type) clona o template correspondente (tpl-modal-*) e preenche
   * o painel #sidebar-modal. bindSidebar() liga os botões uma vez no boot.
   */
  var FILTER_LABELS = {
    inprogress: "Em andamento",
    allincludinghidden: "Todos os di\xE1rios",
    favourites: "Favoritos",
    hidden: "Ocultos"
  };
  var MODAL_META = {
    profile: { title: "Perfil", icon: "person-circle-outline", tpl: "tpl-modal-profile" },
    help: { title: "Ajuda", icon: "help-circle-outline", tpl: "tpl-modal-help" },
    accessibility: { title: "Acessibilidade", icon: "accessibility-outline", tpl: "tpl-modal-accessibility" },
    filter: { title: "Filtros", icon: "filter-outline", tpl: "tpl-modal-filter" }
  };
  var BUTTON_IDS = {
    profile: "btn-toggle-profile",
    help: "btn-toggle-help",
    accessibility: "btn-toggle-accessibility",
    filter: "btn-toggle-filter"
  };
  var userSelectedFilter = false;
  var bound = false;
  var modalTrigger = null;
  var actionSelector = '[aria-controls="sidebar-modal"]';
  App.activeFilter = {
    situacao: "allincludinghidden",
    label: FILTER_LABELS.allincludinghidden
  };
  function getEl2(id) {
    return document.getElementById(id);
  }
  function setActiveButton(type) {
    document.querySelectorAll(actionSelector).forEach((el) => {
      el.classList.remove("active");
      el.setAttribute("aria-expanded", "false");
    });
    const btn = getEl2(BUTTON_IDS[type]);
    if (btn) {
      btn.classList.add("active");
      btn.setAttribute("aria-expanded", "true");
    }
  }
  function clearActiveButtons() {
    document.querySelectorAll(actionSelector).forEach((el) => {
      el.classList.remove("active");
      el.setAttribute("aria-expanded", "false");
    });
  }
  function closeModal() {
    const modal = getEl2("sidebar-modal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    getEl2("main-content")?.removeAttribute("inert");
    clearActiveButtons();
    if (modalTrigger?.isConnected) modalTrigger.focus();
    modalTrigger = null;
  }
  function bindAccessibilityControls() {
    if (App.A11y?.bindPanel) {
      App.A11y.bindPanel();
    }
  }
  function updateFilterChip() {
    const chip = getEl2("sidebar-filter-situacao");
    if (chip && App.activeFilter) {
      chip.textContent = App.activeFilter.label;
    }
  }
  function bindFilterControls() {
    const select = getEl2("filter-situacao");
    const apply = getEl2("filter-apply");
    const clear = getEl2("filter-clear");
    const activeFilter = App.activeFilter;
    if (select && activeFilter) {
      select.value = String(activeFilter.situacao);
    }
    if (apply) {
      apply.addEventListener("click", () => {
        const value = select ? select.value : "allincludinghidden";
        userSelectedFilter = true;
        App.activeFilter = {
          situacao: value,
          label: FILTER_LABELS[value] || FILTER_LABELS.allincludinghidden
        };
        updateFilterChip();
        closeModal();
        if (typeof App.onFilterChange === "function" && App.activeFilter) {
          App.onFilterChange(App.activeFilter);
        }
      });
    }
    if (clear) {
      clear.addEventListener("click", () => {
        userSelectedFilter = true;
        App.activeFilter = {
          situacao: "allincludinghidden",
          label: FILTER_LABELS.allincludinghidden
        };
        updateFilterChip();
        if (select) {
          select.value = "allincludinghidden";
        }
        App.onFilterChange?.(App.activeFilter);
      });
    }
  }
  function openModal(type) {
    const meta = MODAL_META[type];
    const modal = getEl2("sidebar-modal");
    const body = getEl2("sidebar-modal-body");
    const title = getEl2("sidebar-modal-title");
    const icon = getEl2("sidebar-modal-icon");
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
      icon.setAttribute("name", meta.icon);
    }
    if (modal.hidden) modalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    body.innerHTML = "";
    body.appendChild(fragment);
    setActiveButton(type);
    modal.hidden = false;
    getEl2("main-content")?.setAttribute("inert", "");
    getEl2("sidebar-modal-close")?.focus();
    if (type === "profile") {
      const nameEl = getEl2("modal-profile-name");
      if (nameEl) {
        nameEl.textContent = App.sidebarUserName || "Estudante";
      }
      const logoutBtn = getEl2("modal-logout");
      if (logoutBtn && typeof App.logout === "function") {
        logoutBtn.addEventListener("click", () => {
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
  function applyUserFilter(dashboard) {
    if (userSelectedFilter) {
      updateFilterChip();
      return;
    }
    const situacao = dashboard && (dashboard.filtro_situacao || dashboard.situacao || dashboard.filter_situacao) || "allincludinghidden";
    const label = dashboard && (dashboard.filtro_label || dashboard.situacao_label) || FILTER_LABELS[situacao] || FILTER_LABELS.allincludinghidden;
    App.activeFilter = { situacao, label };
    updateFilterChip();
  }
  function bindSidebar() {
    if (bound) return;
    bound = true;
    const triggers = {
      "btn-toggle-profile": "profile",
      "btn-toggle-help": "help",
      "btn-toggle-accessibility": "accessibility",
      "btn-toggle-filter": "filter",
      "sidebar-active-filters": "filter"
    };
    document.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest(actionSelector) : null;
      if (button && triggers[button.id]) {
        openModal(triggers[button.id]);
        button.setAttribute("aria-expanded", "true");
      }
    });
    const closeBtn = getEl2("sidebar-modal-close");
    const backdrop = getEl2("sidebar-modal-backdrop");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }
    if (backdrop) {
      backdrop.addEventListener("click", closeModal);
    }
    document.addEventListener("keydown", (event) => {
      const modal = getEl2("sidebar-modal");
      if (!modal || modal.hidden) return;
      if (event.key === "Escape") {
        closeModal();
      } else if (event.key === "Tab") {
        const controls = Array.from(modal.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]'
        )).filter((el) => !el.closest("[hidden]") && el.getClientRects().length > 0);
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

  // src/MoodleIFRN/navigation/painel-host-layout.ts
  function readPainelHostLayout(host) {
    let probe;
    try {
      probe = host.document.createElement("div");
      probe.style.cssText = [
        "position:fixed",
        "visibility:hidden",
        "pointer-events:none",
        "height:var(--keyboard-height, 0px)",
        "padding-top:var(--ion-safe-area-top, env(safe-area-inset-top, 0px))",
        "padding-right:var(--ion-safe-area-right, env(safe-area-inset-right, 0px))",
        "padding-bottom:var(--ion-safe-area-bottom, env(safe-area-inset-bottom, 0px))",
        "padding-left:var(--ion-safe-area-left, env(safe-area-inset-left, 0px))"
      ].join(";");
      host.document.documentElement.appendChild(probe);
      const style = host.getComputedStyle(probe);
      const pixels = (value) => Math.max(0, Number.parseFloat(value) || 0);
      return {
        insets: {
          top: pixels(style.paddingTop),
          right: pixels(style.paddingRight),
          bottom: pixels(style.paddingBottom),
          left: pixels(style.paddingLeft)
        },
        keyboardHeight: pixels(style.height)
      };
    } catch {
      return null;
    } finally {
      probe?.remove();
    }
  }

  // src/MoodleIFRN/mobilemoodle/core_mobile/app-keyboard.ts
  /*!
   * app-keyboard.ts
   * ----------------------------------------------------------------------------
   * Dois papéis:
   *   1) Safe-area (status bar / notch) → CSS vars --ion-safe-area-*
   *   2) Altura do teclado virtual → --keyboard-height + classe .keyboard-is-open
   *
   * Android nativo (Cordova):
   *   - Preferência: cordova-plugin-insets (window.totalpave.Inset), igual ao core Moodle
   *   - Fallback: ~24px só se Cordova existir e o inset vier 0
   *
   * Browser / DevTools (“console mobile”):
   *   - NÃO força padding no topo (não há status bar sobrepondo o WebView)
   */
  var KEYBOARD_THRESHOLD = 80;
  var ANDROID_STATUS_BAR_FALLBACK_PX = 24;
  var INSET_MASK_SYSTEM_AND_CUTOUT = 64 | 2;
  function isAndroidWebView() {
    return /Android/i.test(navigator.userAgent);
  }
  function isCordovaRuntime() {
    return !!window.cordova;
  }
  function getCordovaInsetApi() {
    const api = window.totalpave?.Inset;
    if (api && typeof api.create === "function") {
      return api;
    }
    return null;
  }
  function waitForCordova(timeoutMs = 1500) {
    return new Promise((resolve) => {
      if (!isCordovaRuntime()) {
        resolve();
        return;
      }
      let settled = false;
      const done = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };
      document.addEventListener("deviceready", done, { once: true });
      window.setTimeout(done, timeoutMs);
    });
  }
  function readCssEnvInsets() {
    const probe = document.createElement("div");
    probe.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
      "visibility:hidden",
      "pointer-events:none"
    ].join(";");
    document.documentElement.appendChild(probe);
    const style = getComputedStyle(probe);
    const insets = {
      top: parseFloat(style.paddingTop) || 0,
      right: parseFloat(style.paddingRight) || 0,
      bottom: parseFloat(style.paddingBottom) || 0,
      left: parseFloat(style.paddingLeft) || 0
    };
    probe.remove();
    return insets;
  }
  function setSafeAreaVars(insets) {
    const root = document.documentElement.style;
    root.setProperty("--ion-safe-area-top", `${Math.max(0, insets.top)}px`);
    root.setProperty("--ion-safe-area-right", `${Math.max(0, insets.right)}px`);
    root.setProperty("--ion-safe-area-bottom", `${Math.max(0, insets.bottom)}px`);
    root.setProperty("--ion-safe-area-left", `${Math.max(0, insets.left)}px`);
  }
  function resolveFallbackInsets() {
    const hostInsets = readHostInsets();
    if (hostInsets) {
      return hostInsets;
    }
    if (!isCordovaRuntime()) {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }
    const insets = readCssEnvInsets();
    if (insets.top <= 0 && isAndroidWebView()) {
      insets.top = ANDROID_STATUS_BAR_FALLBACK_PX;
    }
    return insets;
  }
  function readHostInsets() {
    return readEmbeddedHostLayout()?.insets ?? null;
  }
  function readEmbeddedHostLayout() {
    try {
      if (window.parent === window) {
        return null;
      }
      return readPainelHostLayout(window.parent);
    } catch {
      return null;
    }
  }
  function hasIOSHost() {
    try {
      return window.parent.cordova?.platformId === "ios";
    } catch {
      return false;
    }
  }
  function applySafeAreaVariables() {
    setSafeAreaVars(resolveFallbackInsets());
  }
  async function initNativeSafeAreaInsets() {
    if (readHostInsets()) {
      return false;
    }
    await waitForCordova();
    const Inset = getCordovaInsetApi();
    if (!Inset) {
      return false;
    }
    try {
      const listener = await Inset.create({
        mask: INSET_MASK_SYSTEM_AND_CUTOUT,
        includeRoundedCorners: false
      });
      const apply = () => {
        setSafeAreaVars(listener.getInset());
      };
      listener.addListener(apply);
      apply();
      return true;
    } catch {
      return false;
    }
  }
  function syncKeyboardHeight() {
    const host = readEmbeddedHostLayout();
    if (host && hasIOSHost()) {
      setSafeAreaVars(host.insets);
      document.documentElement.style.setProperty("--keyboard-height", "0px");
      document.body.classList.toggle("keyboard-is-open", host.keyboardHeight >= KEYBOARD_THRESHOLD);
      if (host.keyboardHeight >= KEYBOARD_THRESHOLD) {
        document.documentElement.style.setProperty("--ion-safe-area-bottom", "0px");
      }
      return;
    }
    const viewport = window.visualViewport;
    let keyboardHeight = 0;
    if (viewport) {
      keyboardHeight = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
    }
    const isOpen = keyboardHeight >= KEYBOARD_THRESHOLD;
    const appliedHeight = isOpen ? keyboardHeight : 0;
    document.documentElement.style.setProperty("--keyboard-height", `${appliedHeight}px`);
    document.body.classList.toggle("keyboard-is-open", isOpen);
    if (isOpen) {
      document.documentElement.style.setProperty("--ion-safe-area-bottom", "0px");
    } else if (!getCordovaInsetApi()) {
      applySafeAreaVariables();
    }
  }
  function scrollFocusedFieldIntoView() {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) {
      return;
    }
    if (!active.matches("input, textarea, select")) {
      return;
    }
    window.setTimeout(() => {
      active.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 320);
  }
  function initKeyboardInsets() {
    if (readHostInsets()) {
      const observer = new MutationObserver(() => {
        const insets = readHostInsets();
        if (insets) {
          setSafeAreaVars(insets);
        }
        if (hasIOSHost()) {
          syncKeyboardHeight();
        }
      });
      observer.observe(window.parent.document.documentElement, { attributes: true, attributeFilter: ["style"] });
      window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
    }
    setSafeAreaVars({ top: 0, right: 0, bottom: 0, left: 0 });
    applySafeAreaVariables();
    void initNativeSafeAreaInsets().then((nativeOk) => {
      if (!nativeOk) {
        applySafeAreaVariables();
      }
      syncKeyboardHeight();
      return;
    });
    syncKeyboardHeight();
    window.visualViewport?.addEventListener("resize", syncKeyboardHeight);
    window.visualViewport?.addEventListener("scroll", syncKeyboardHeight);
    window.addEventListener("resize", () => {
      if (!getCordovaInsetApi()) {
        applySafeAreaVariables();
      }
      syncKeyboardHeight();
    });
    window.addEventListener("orientationchange", () => {
      window.setTimeout(() => {
        if (!getCordovaInsetApi()) {
          applySafeAreaVariables();
        }
        syncKeyboardHeight();
      }, 250);
    });
    document.addEventListener("focusin", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches("input, textarea, select")) {
        return;
      }
      window.setTimeout(syncKeyboardHeight, 280);
      scrollFocusedFieldIntoView();
    });
    document.addEventListener("focusout", () => {
      window.setTimeout(syncKeyboardHeight, 280);
    });
  }

  // src/MoodleIFRN/mobilemoodle/core_mobile/app.ts
  /*!
   * app.ts
   * ----------------------------------------------------------------------------
   * Bootstrap do painel (roda por último na ordem de imports).
   *
   * No DOMContentLoaded:
   *   1. Safe-area / teclado (app-keyboard)
   *   2. Base URL da API
   *   3. Preferências de acessibilidade
   *   4. Sidebar
   *   5. loadRoute() conforme o hash (#/painel, #/curso/…)
   *
   * hashchange → navega sem recarregar a página.
   */
  App.content = document.getElementById("page-content");
  App.title = document.getElementById("page-title");
  App.subtitle = document.getElementById("page-subtitle");
  App.menuUserInfo = document.getElementById("sidebar-user-name");
  App.toolbarAvatar = document.getElementById("toolbar-avatar");
  App.templatesRoot = document.getElementById("page-templates");
  App.dashboardCache = null;
  function logout() {
    const lastMoodleSite = sessionStorage.getItem("ifrn_moodle_last_site_url");
    let webLogoutUrl = null;
    if (lastMoodleSite) {
      try {
        const origin = new URL(lastMoodleSite).origin;
        if (origin.startsWith("https://")) {
          webLogoutUrl = `${origin}/auth/suap/logout.php`;
        }
      } catch {
      }
    }
    if (webLogoutUrl) {
      window.open(webLogoutUrl, "_system");
    }
    if (window.MobileMoodleApi?.clearToken) {
      window.MobileMoodleApi.clearToken();
    }
    ["ifrn_access_token", "ifrn_refresh_token", "ifrn_username", "ifrn_biometric_login_enabled"].forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem("ifrn_username");
    sessionStorage.removeItem("ifrn_moodle_last_site_url");
    App.dashboardCache = null;
    const bridge = window.parent?.MoodleIfrnBridge;
    if (window.parent && window.parent !== window && bridge?.logout) {
      bridge.logout();
      return;
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "MOODLE_IFRN_LOGOUT" }, "*");
      return;
    }
    const loginUrl = typeof App.resolveLoginUrl === "function" ? App.resolveLoginUrl() : "/login/marketplace-ifrn";
    window.location.replace(loginUrl);
  }
  App.logout = logout;
  function bindMenu() {
    if (typeof App.bindSidebar === "function") {
      App.bindSidebar();
    }
  }
  function resolveApiBase() {
    return "https://suap.ifrn.edu.br";
  }
  window.addEventListener("hashchange", () => {
    App.loadRoute?.(false);
  });
  window.addEventListener("DOMContentLoaded", () => {
    initKeyboardInsets();
    if (window.MobileMoodleApi?.setApiBaseUrl) {
      window.MobileMoodleApi.setApiBaseUrl(resolveApiBase());
    }
    if (App.A11y?.init) {
      App.A11y.init();
    }
    bindMenu();
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash || hash === "/") {
      window.location.hash = "/painel";
      return;
    }
    App.loadRoute?.(false);
  });

  // src/MoodleIFRN/mobilemoodle/mobilemoodle.ts
  /*!
   * Ponto de entrada do painel mobilemoodle.
   * Ordem de inicialização dos módulos (namespace window.MobileMoodle).
   */
})();
