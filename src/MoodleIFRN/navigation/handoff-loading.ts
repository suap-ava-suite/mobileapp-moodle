/**
 * Handoff loading — consolidado conforme F08 (Camadas de loading duplicadas).
 * Os overlays DOM duplicados foram removidos; o carregamento é gerenciado
 * de forma unificada pelas páginas do app.
 */

const HANDOFF_PENDING_KEY = 'ifrn_course_handoff_pending';

export function shouldShowCourseHandoffOnBoot(): boolean {
    return false;
}

export function showHandoffLoading(): void {
    // Camada de overlay DOM duplicada removida conforme F08.
    const existing = document.getElementById('ifrn-handoff-loading');
    if (existing) {
        existing.remove();
    }
    document.documentElement.classList.remove('ifrn-native-handoff');
}

export function hideHandoffLoading(): void {
    const existing = document.getElementById('ifrn-handoff-loading');
    if (existing) {
        existing.remove();
    }
    document.documentElement.classList.remove('ifrn-native-handoff');
    try {
        sessionStorage.removeItem(HANDOFF_PENDING_KEY);
    } catch {
        // ignore
    }
}
