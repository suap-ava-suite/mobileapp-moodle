#!/usr/bin/env node
/**
 * Compila o painel mobilemoodle: mobilemoodle.ts + core_mobile/ → mobilemoodle.js.
 */
import { build } from 'esbuild';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const entry = join(root, 'mobilemoodle.ts');
const outfile = join(root, 'mobilemoodle.js');
try {
    await build({
        absWorkingDir: join(root, '../../..'),
        entryPoints: [entry],
        outfile,
        bundle: true,
        format: 'iife',
        target: 'es2020',
        logLevel: 'warning',
        legalComments: 'inline',
    });
} catch (error) {
    console.error('Falha ao compilar mobilemoodle:', error);
    process.exit(1);
}

console.log('✔ mobilemoodle compilado → mobilemoodle.js');
