'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const BASE_COMMIT = '4942598b6';
const TARGETS = [
    'cordova-plugin-moodleapp/src/android/SecureStorage.java',
    'cordova-plugin-moodleapp/src/ios/SecureStorage.m',
    'cordova-plugin-moodleapp/src/ts/plugins/SecureStorage.ts',
    'src/core/classes/database/database-table-proxy.ts',
    'src/core/classes/database/database-table.ts',
    'src/core/classes/database/eager-database-table.ts',
    'src/core/classes/tests/database-table.test.ts',
    'src/core/features/emulator/classes/SecureStorage.ts',
    'src/core/services/database/sites.ts',
    'src/core/services/sites.ts',
    'src/core/services/urlschemes.ts',
    'src/core/static/events.ts',
];
const PATCH_PATH = 'src/MoodleIFRN/patches/p0.4-session-isolation.patch';
const MANIFEST_PATH = 'src/MoodleIFRN/patches/p0.4-session-isolation.manifest.json';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const sha256Source = value => sha256(value.toString('utf8').replace(/\r\n/g, '\n'));

const patch = execFileSync('git', ['diff', '--binary', BASE_COMMIT, '--', ...TARGETS], { cwd: ROOT });
if (!patch.length) {
    throw new Error('Nenhuma diferença P0.4 foi encontrada em relação ao commit-base.');
}

const manifest = {
    schema: 'ifrn-core-patch/v1',
    id: 'ifrn-p0.4-session-isolation.v1',
    baseCommit: BASE_COMMIT,
    patchPath: PATCH_PATH,
    patchSha256: sha256(patch),
    targets: TARGETS.map(file => {
        const base = execFileSync('git', ['show', `${BASE_COMMIT}:${file}`], { cwd: ROOT });
        const current = fs.readFileSync(path.join(ROOT, file));

        return { path: file, baseSha256: sha256Source(base), postSha256: sha256Source(current) };
    }),
};

const patchFile = path.join(ROOT, PATCH_PATH);
const manifestFile = path.join(ROOT, MANIFEST_PATH);
fs.mkdirSync(path.dirname(patchFile), { recursive: true });
fs.writeFileSync(patchFile, patch);
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Patch P0.4 gerado para ${manifest.targets.length} arquivos.`);
