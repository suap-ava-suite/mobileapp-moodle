#!/usr/bin/env node
/**
 * Compila o painel mobilemoodle: mobilemoodle.ts + core_mobile/ → mobilemoodle.js.
 */
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const entry = join(root, 'mobilemoodle.ts');
const outfile = join(root, 'mobilemoodle.js');

execSync(
    `npx --yes esbuild "${entry}" --bundle --outfile="${outfile}" --format=iife --target=es2020 --log-level=warning`,
    { stdio: 'inherit', cwd: join(root, '../../..') },
);

console.log('✔ mobilemoodle compilado → mobilemoodle.js');
