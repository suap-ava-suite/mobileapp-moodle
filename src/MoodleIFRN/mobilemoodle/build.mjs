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

const banner = '/* mobilemoodle.js - bundle gerado do Painel AVA (IFRN). Edite os arquivos .ts e rode npm run build:mobilemoodle. */';

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
