#!/usr/bin/env node
/**
 * Compila o painel mobilemoodle: mobilemoodle.ts + core_mobile/ → mobilemoodle.js
 * e sincroniza os assets locais do Ionic e Ionicons (@ionic/core e ionicons).
 */
import { build } from 'esbuild';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createHash } from 'crypto';
import { compile } from 'sass';
import angularTheme from '../scripts/painel-angular-theme.cjs';

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
    const themeCss = compile(join(root, 'static/theme/ifrn/scss/painel.scss'), {
        style: 'expanded',
    }).css.replaceAll('url("../fonts/', 'url("static/theme/ifrn/fonts/');
    // Folha bloqueante no <head>: o iframe nunca pinta as logos sem o tema
    // enquanto aguarda o bundle deferred, inclusive ao voltar do curso nativo.
    fs.writeFileSync(join(root, 'mobilemoodle.css'), themeCss);
    // Same declarations/assets, with root selectors scoped to the Angular host.
    fs.writeFileSync(join(root, '../painel/painel-native-theme.css'), angularTheme.painelAngularTheme(themeCss));
    const themeVersion = createHash('sha256').update(themeCss).digest('hex').slice(0, 12);
    const indexPath = join(root, 'index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    const versionedIndexHtml = indexHtml.replace(
        /(<link\s+id="ifrn-panel-theme"\s+rel="stylesheet"\s+href="mobilemoodle\.css)(?:\?v=[a-f0-9]+)?("\s*>)/,
        `$1?v=${themeVersion}$2`,
    );
    if (versionedIndexHtml === indexHtml && !indexHtml.includes(`mobilemoodle.css?v=${themeVersion}`)) {
        throw new Error('Não foi possível versionar a folha de tema IFRN no index.html.');
    }
    if (versionedIndexHtml !== indexHtml) {
        fs.writeFileSync(indexPath, versionedIndexHtml);
    }
    await build({
        absWorkingDir: projectRoot,
        entryPoints: [entry],
        outfile,
        bundle: true,
        format: 'iife',
        target: 'es2020',
        define: {
            __IFRN_SUAP_TIMING__: JSON.stringify(process.env.NODE_ENV === 'development'),
        },
        logLevel: 'warning',
        legalComments: 'inline',
    });
} catch (error) {
    console.error('Falha ao compilar mobilemoodle:', error);
    process.exit(1);
}

console.log('✔ mobilemoodle compilado → mobilemoodle.js (vendor local sincronizado)');
