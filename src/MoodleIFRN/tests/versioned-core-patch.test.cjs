'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { applyVersionedPatch, inspectVersionedPatch, sha256, sha256Source } = require('../scripts/apply-versioned-core-patch.cjs');

function makeFixture(t, source = 'export const version = 1;\n') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ifrn-core-patch-'));
    const sourcePath = path.join(root, 'src/core/session.ts');
    const patchPath = path.join(root, 'src/MoodleIFRN/patches/session.patch');
    const manifestPath = path.join(root, 'src/MoodleIFRN/patches/session.manifest.json');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.mkdirSync(path.dirname(patchPath), { recursive: true });
    fs.writeFileSync(sourcePath, source);

    const next = source.replace('version = 1', 'version = 2');
    const patch = Buffer.from([
        'diff --git a/src/core/session.ts b/src/core/session.ts',
        '--- a/src/core/session.ts',
        '+++ b/src/core/session.ts',
        '@@ -1 +1 @@',
        '-export const version = 1;',
        '+export const version = 2;',
        '',
    ].join('\n'));
    fs.writeFileSync(patchPath, patch);
    const manifest = {
        schema: 'ifrn-core-patch/v1',
        id: 'ifrn-test-patch.v1',
        baseCommit: 'synthetic-base',
        patchPath: 'src/MoodleIFRN/patches/session.patch',
        patchSha256: crypto.createHash('sha256').update(patch).digest('hex'),
        targets: [{
            path: 'src/core/session.ts',
            baseSha256: sha256Source(Buffer.from(source)),
            postSha256: sha256Source(Buffer.from(next)),
        }],
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    return { root, sourcePath, manifestPath, manifest, next };
}

test('versioned core patch applies after full preflight and is idempotent', t => {
    const { root, sourcePath, manifestPath, next } = makeFixture(t);
    assert.equal(inspectVersionedPatch(manifestPath, root).state, 'ready');

    assert.equal(applyVersionedPatch(manifestPath, root).applied, true);
    assert.equal(fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n'), next);
    assert.equal(inspectVersionedPatch(manifestPath, root).state, 'already-applied');
    assert.equal(applyVersionedPatch(manifestPath, root).state, 'already-applied');
});

test('versioned core patch fails closed on modified source or patch hash mismatch', t => {
    const { root, sourcePath, manifestPath, manifest } = makeFixture(t);
    fs.writeFileSync(sourcePath, 'export const version = 3;\n');
    assert.throws(() => applyVersionedPatch(manifestPath, root), /incompatível/);

    const compatible = makeFixture(t);
    compatible.manifest.patchSha256 = '0'.repeat(64);
    fs.writeFileSync(compatible.manifestPath, JSON.stringify(compatible.manifest));
    assert.throws(() => inspectVersionedPatch(compatible.manifestPath, compatible.root), /Hash do patch diverge/);
});
