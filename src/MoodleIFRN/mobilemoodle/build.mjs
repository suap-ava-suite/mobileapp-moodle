#!/usr/bin/env node
/**
 * Compila o painel mobilemoodle: mobilemoodle.ts + core_mobile/ → mobilemoodle.js.
 *
 * Usa a API JS do esbuild (e não o binário via npx): no Windows o `npx` é
 * `npx.cmd` e o spawnSync sem shell falha em silêncio com status null.
 */
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, '../../..');
const entry = join(root, 'mobilemoodle.ts');
const outfile = join(root, 'mobilemoodle.js');

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

let esbuild;

try {
    // Resolve a partir da raiz do projeto, onde o esbuild está instalado.
    const require = createRequire(join(projectRoot, 'package.json'));

    esbuild = require('esbuild');
} catch {
    console.error(
        'esbuild não encontrado em node_modules. Rode "npm install" (ou "npm i -D esbuild") e tente de novo.',
    );
    process.exit(1);
}

try {
    await esbuild.build({
        entryPoints: [entry],
        outfile,
        bundle: true,
        format: 'iife',
        target: 'es2020',
        logLevel: 'warning',
        legalComments: 'inline',
        absWorkingDir: projectRoot,
        banner: { js: banner },
    });
} catch {
    // O esbuild já imprimiu os erros de compilação.
    process.exit(1);
}

console.log('✔ mobilemoodle compilado → mobilemoodle.js');
