/**
 * app-keyboard.ts
 * Sincroniza altura do teclado e safe-areas no painel mobilemoodle (WebView standalone).
 */

const KEYBOARD_THRESHOLD = 80;

function readSafeAreaInsets(): { top: number; bottom: number; left: number; right: number } {
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

    const insets = {
        top: parseFloat(style.paddingTop) || 0,
        right: parseFloat(style.paddingRight) || 0,
        bottom: parseFloat(style.paddingBottom) || 0,
        left: parseFloat(style.paddingLeft) || 0,
    };

    probe.remove();

    return insets;
}

function applySafeAreaVariables(): void {
    const insets = readSafeAreaInsets();
    const root = document.documentElement.style;

    root.setProperty('--ion-safe-area-top', `${insets.top}px`);
    root.setProperty('--ion-safe-area-right', `${insets.right}px`);
    root.setProperty('--ion-safe-area-bottom', `${insets.bottom}px`);
    root.setProperty('--ion-safe-area-left', `${insets.left}px`);
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
        const insets = readSafeAreaInsets();
        document.documentElement.style.setProperty('--ion-safe-area-bottom', '0px');
        document.documentElement.style.setProperty('--ion-safe-area-top', `${insets.top}px`);
    } else {
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
    applySafeAreaVariables();

    syncKeyboardHeight();

    window.visualViewport?.addEventListener('resize', syncKeyboardHeight);
    window.visualViewport?.addEventListener('scroll', syncKeyboardHeight);
    window.addEventListener('resize', () => {
        applySafeAreaVariables();
        syncKeyboardHeight();
    });
    window.addEventListener('orientationchange', () => {
        window.setTimeout(() => {
            applySafeAreaVariables();
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
