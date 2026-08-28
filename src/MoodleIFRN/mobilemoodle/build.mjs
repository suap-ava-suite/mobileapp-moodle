#!/usr/bin/env node
/**
 * Compila o painel mobilemoodle: TypeScript (ts/) → bundle único (dist/mobilemoodle.js).
 */
import { execSync } from 'child_process';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const entry = join(root, 'ts/main.ts');
const outdir = join(root, 'dist');
const outfile = join(outdir, 'mobilemoodle.js');

mkdirSync(outdir, { recursive: true });

execSync(
    `npx --yes esbuild "${entry}" --bundle --outfile="${outfile}" --format=iife --target=es2020 --log-level=warning`,
    { stdio: 'inherit', cwd: join(root, '../../..') },
);

console.log('✔ mobilemoodle compilado → dist/mobilemoodle.js');
