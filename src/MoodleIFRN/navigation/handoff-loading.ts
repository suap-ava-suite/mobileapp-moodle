/* eslint-disable header/header */

// IFRN course transition cover, layered above the native Moodle route.

const HANDOFF_PENDING_KEY = 'ifrn_course_handoff_pending';
const HANDOFF_ID = 'ifrn-handoff-loading';

/**
 * Handoff overlay is intentionally not restored on app boot.
 *
 * @returns Whether a pending course handoff should be restored on boot.
 */
export function shouldShowCourseHandoffOnBoot(): boolean {
    return false;
}

/** Show the branded cover while the native course page is being prepared. */
export function showHandoffLoading(): void {
    const root = document.documentElement;
    root.classList.add('ifrn-native-handoff');

    // Reuse an existing cover when callbacks for the same opening arrive twice.
    const current = document.getElementById(HANDOFF_ID);
    if (current) {
        current.style.opacity = '1';

        return;
    }

    const overlay = document.createElement('div');
    overlay.id = HANDOFF_ID;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', 'Abrindo sua disciplina');
    Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        color: '#333333',
        fontFamily: 'Rawline, Roboto, sans-serif',
        opacity: '1',
        pointerEvents: 'auto',
    });

    const content = document.createElement('div');
    Object.assign(content.style, {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '32px',
        textAlign: 'center',
    });

    const brand = document.createElement('div');
    Object.assign(brand.style, {
        width: 'min(132px, 34vw)',
        aspectRatio: '1',
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        flex: '0 0 auto',
    });

    const logo = document.createElement('img');
    logo.alt = 'Moodle IFRN';
    logo.src = new URL('mobilemoodle/static/theme/ifrn/img/splash-logo.png', document.baseURI).toString();
    Object.assign(logo.style, {
        width: '68%',
        height: '68%',
        aspectRatio: '1',
        borderRadius: '50%',
        objectFit: 'cover',
        background: '#ffffff',
        boxShadow: '0 2px 10px rgba(7, 29, 65, 0.12)',
        position: 'relative',
        zIndex: '1',
    });

    const spinner = document.createElement('div');
    spinner.setAttribute('aria-hidden', 'true');
    Object.assign(spinner.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        border: '3px solid rgba(19, 81, 180, 0.14)',
        borderTopColor: '#1351b4',
        borderRadius: '50%',
        animation: 'ifrn-handoff-spin 1.1s linear infinite',
    });

    const message = document.createElement('div');
    message.textContent = 'Abrindo sua disciplina...';
    Object.assign(message.style, { fontSize: '1rem', fontWeight: '600', margin: '0', textAlign: 'center' });

    if (!document.getElementById('ifrn-handoff-style')) {
        const style = document.createElement('style');
        style.id = 'ifrn-handoff-style';
        style.textContent = '@keyframes ifrn-handoff-spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    }

    brand.append(logo, spinner);
    content.append(brand, message);
    overlay.appendChild(content);
    (document.body || document.documentElement).appendChild(overlay);
}

/** Remove the handoff cover when the course is ready or the attempt ends. */
export function hideHandoffLoading(): void {
    const existing = document.getElementById(HANDOFF_ID);
    if (existing) {
        existing.remove();
    }
    document.documentElement.classList.remove('ifrn-native-handoff');
    try {
        sessionStorage.removeItem(HANDOFF_PENDING_KEY);
    } catch {
        // Storage can be unavailable in restricted WebViews.
    }
}
