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
const KEYBOARD_THRESHOLD = 80;

/** Só no Cordova Android, se o plugin de insets falhar. */
const ANDROID_STATUS_BAR_FALLBACK_PX = 24;

/** SYSTEM_BARS | DISPLAY_CUTOUT — espelha initialize-edge-to-edge do Moodle. */
const INSET_MASK_SYSTEM_AND_CUTOUT = 64 | 2;

type SafeInsets = { top: number; right: number; bottom: number; left: number };

interface CordovaInsetListener {
    getInset(): SafeInsets;
    addListener(callback: (inset: SafeInsets) => void): void;
}

interface CordovaInsetApi {
    create(config: { mask: number; includeRoundedCorners?: boolean }): Promise<CordovaInsetListener>;
}

function isAndroidWebView(): boolean {
    return /Android/i.test(navigator.userAgent);
}

function isCordovaRuntime(): boolean {
    return !!(window as Window & { cordova?: unknown }).cordova;
}

function getCordovaInsetApi(): CordovaInsetApi | null {
    const api = window.totalpave?.Inset;

    if (api && typeof api.create === 'function') {
        return api as CordovaInsetApi;
    }

    return null;
}

function waitForCordova(timeoutMs = 1500): Promise<void> {
    return new Promise((resolve) => {
        if (!isCordovaRuntime()) {
            resolve();

            return;
        }

        let settled = false;
        const done = (): void => {
            if (settled) {
                return;
            }

            settled = true;
            resolve();
        };

        document.addEventListener('deviceready', done, { once: true });
        window.setTimeout(done, timeoutMs);
    });
}

function readCssEnvInsets(): SafeInsets {
    const probe = document.createElement('div');

    probe.style.cssText = [
        'position:fixed',
        'top:0',
        'left:0',
        'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
        'visibility:hidden',
        'pointer-events:none',
    ].join(';');

    document.documentElement.appendChild(probe);
    const style = getComputedStyle(probe);

    const insets: SafeInsets = {
        top: parseFloat(style.paddingTop) || 0,
        right: parseFloat(style.paddingRight) || 0,
        bottom: parseFloat(style.paddingBottom) || 0,
        left: parseFloat(style.paddingLeft) || 0,
    };

    probe.remove();

    return insets;
}

function setSafeAreaVars(insets: SafeInsets): void {
    const root = document.documentElement.style;

    root.setProperty('--ion-safe-area-top', `${Math.max(0, Math.round(insets.top))}px`);
    root.setProperty('--ion-safe-area-right', `${Math.max(0, Math.round(insets.right))}px`);
    root.setProperty('--ion-safe-area-bottom', `${Math.max(0, Math.round(insets.bottom))}px`);
    root.setProperty('--ion-safe-area-left', `${Math.max(0, Math.round(insets.left))}px`);
}

function resolveFallbackInsets(): SafeInsets {
    // Console / browser (sem Cordova): zero no topo — não há status bar sobrepondo.
    if (!isCordovaRuntime()) {
        return { top: 0, right: 0, bottom: 0, left: 0 };
    }

    const insets = readCssEnvInsets();

    // Cordova Android sem valor de env/plugin: fallback curto da status bar.
    if (insets.top <= 0 && isAndroidWebView()) {
        insets.top = ANDROID_STATUS_BAR_FALLBACK_PX;
    }

    return insets;
}

function applySafeAreaVariables(): void {
    setSafeAreaVars(resolveFallbackInsets());
}

async function initNativeSafeAreaInsets(): Promise<boolean> {
    await waitForCordova();

    const Inset = getCordovaInsetApi();

    if (!Inset) {
        return false;
    }

    try {
        const listener = await Inset.create({
            mask: INSET_MASK_SYSTEM_AND_CUTOUT,
            includeRoundedCorners: false,
        });

        const apply = (): void => {
            setSafeAreaVars(listener.getInset());
        };

        listener.addListener(apply);
        apply();

        return true;
    } catch {
        return false;
    }
}

function syncKeyboardHeight(): void {
    const viewport = window.visualViewport;
    let keyboardHeight = 0;

    if (viewport) {
        keyboardHeight = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
    }

    const isOpen = keyboardHeight >= KEYBOARD_THRESHOLD;
    const appliedHeight = isOpen ? keyboardHeight : 0;

    document.documentElement.style.setProperty('--keyboard-height', `${appliedHeight}px`);
    document.body.classList.toggle('keyboard-is-open', isOpen);

    if (isOpen) {
        document.documentElement.style.setProperty('--ion-safe-area-bottom', '0px');
    } else if (!getCordovaInsetApi()) {
        applySafeAreaVariables();
    }
}

function scrollFocusedFieldIntoView(): void {
    const active = document.activeElement;

    if (!(active instanceof HTMLElement)) {
        return;
    }

    if (!active.matches('input, textarea, select')) {
        return;
    }

    window.setTimeout(() => {
        active.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 320);
}

export function initKeyboardInsets(): void {
    // Zera primeiro para não herdar padding fantasma do Ionic no console.
    setSafeAreaVars({ top: 0, right: 0, bottom: 0, left: 0 });
    applySafeAreaVariables();

    void initNativeSafeAreaInsets().then((nativeOk) => {
        if (!nativeOk) {
            applySafeAreaVariables();
        }
    });

    syncKeyboardHeight();

    window.visualViewport?.addEventListener('resize', syncKeyboardHeight);
    window.visualViewport?.addEventListener('scroll', syncKeyboardHeight);
    window.addEventListener('resize', () => {
        if (!getCordovaInsetApi()) {
            applySafeAreaVariables();
        }

        syncKeyboardHeight();
    });
    window.addEventListener('orientationchange', () => {
        window.setTimeout(() => {
            if (!getCordovaInsetApi()) {
                applySafeAreaVariables();
            }

            syncKeyboardHeight();
        }, 250);
    });

    document.addEventListener('focusin', (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement) || !target.matches('input, textarea, select')) {
            return;
        }

        window.setTimeout(syncKeyboardHeight, 280);
        scrollFocusedFieldIntoView();
    });

    document.addEventListener('focusout', () => {
        window.setTimeout(syncKeyboardHeight, 280);
    });
}
