#!/usr/bin/env node
/**
 * Compila o painel mobilemoodle: mobilemoodle.ts + core_mobile/ → mobilemoodle.js
 * e sincroniza os assets locais do Ionic e Ionicons (@ionic/core e ionicons).
 */
import { build } from 'esbuild';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, '../../..');
const entry = join(root, 'mobilemoodle.ts');
const outfile = join(root, 'mobilemoodle.js');

function copyDirRecursive(src, dest) {
    if (!fs.existsSync(src)) {
        return;
    }
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const item of entries) {
        const srcPath = join(src, item.name);
        const destPath = join(dest, item.name);
        if (item.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function syncVendorAssets() {
    const ionicCore = join(projectRoot, 'node_modules/@ionic/core');
    const ionicons = join(projectRoot, 'node_modules/ionicons');
    const vendorDir = join(root, 'static/vendor');

    if (fs.existsSync(ionicCore)) {
        const cssDest = join(vendorDir, 'ionic/css');
        fs.mkdirSync(cssDest, { recursive: true });
        const cssSrc = join(ionicCore, 'css/ionic.bundle.css');
        if (fs.existsSync(cssSrc)) {
            fs.copyFileSync(cssSrc, join(cssDest, 'ionic.bundle.css'));
        }

        const distIonicSrc = join(ionicCore, 'dist/ionic');
        const distIonicDest = join(vendorDir, 'ionic/dist/ionic');
        copyDirRecursive(distIonicSrc, distIonicDest);
    }

    if (fs.existsSync(ionicons)) {
        const distIonIconsSrc = join(ionicons, 'dist/ionicons');
        const distIonIconsDest = join(vendorDir, 'ionicons/dist/ionicons');
        copyDirRecursive(distIonIconsSrc, distIonIconsDest);
    }
}

try {
    syncVendorAssets();
    await build({
        absWorkingDir: projectRoot,
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

console.log('✔ mobilemoodle compilado → mobilemoodle.js (vendor local sincronizado)');
