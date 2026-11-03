/* eslint-disable header/header */

// Telemetria segura do Painel standalone, executada fora do Angular.

declare const __IFRN_SUAP_TIMING__: boolean;

const SAFE_STAGES = new Set([
    'panel-templates-ready',
    'panel-dashboard-ready',
    'panel-render-to-frame',
]);

/**
 * Registra uma etapa permitida e sua duração numérica em builds de diagnóstico.
 *
 * @param stage Etapa segura previamente permitida.
 * @param durationMs Duração observada em milissegundos.
 */
export function reportSuapDuration(stage: string, durationMs: number): void {
    if (!__IFRN_SUAP_TIMING__ || !SAFE_STAGES.has(stage) || !Number.isFinite(durationMs) || durationMs < 0) {
        return;
    }

    // eslint-disable-next-line no-console
    console.info(`[IFRN-SUAP-TIMING] ${JSON.stringify({ stage, durationMs: Math.round(durationMs) })}`);
}
