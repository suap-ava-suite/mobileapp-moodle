#!/usr/bin/env node
/**
 * Compila o painel mobilemoodle: mobilemoodle.ts + core_mobile/ → mobilemoodle.js.
 */
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const entry = join(root, 'mobilemoodle.ts');
const outfile = join(root, 'mobilemoodle.js');
const cwd = join(root, '../../..');

const banner = `/*!
 * mobilemoodle.js — bundle do Painel AVA (IFRN)
 * ----------------------------------------------------------------------------
 * IMPORTANTE: este é o único JS que o index.html carrega no navegador.
 * Sem ele o painel não autentica, não busca diários no SUAP e não renderiza UI.
 *
 * Origem: compilação de mobilemoodle.ts + core_mobile/*.ts (esbuild IIFE).
 * NÃO edite a lógica aqui — altere os .ts e rode: npm run build:mobilemoodle
 *
 * Ordem dos módulos no bundle:
 *   namespace → api-errors → api-auth → api-http → api-suap → api
 *   → app-utils → app-status → app-views → app-router
 *   → app-accessibility → app-sidebar → app-keyboard → app (bootstrap)
 *
 * Globais expostas:
 *   window.MobileMoodle     — namespace interno (MM / App)
 *   window.MobileMoodleApi  — fachada pública (token, dashboard, curso)
 */`;

const result = spawnSync(
    'npx',
    [
        '--yes',
        'esbuild',
        entry,
        '--bundle',
        `--outfile=${outfile}`,
        '--format=iife',
        '--target=es2020',
        '--log-level=warning',
        '--legal-comments=inline',
        `--banner:js=${banner}`,
    ],
    { stdio: 'inherit', cwd },
);

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}

console.log('✔ mobilemoodle compilado → mobilemoodle.js');
