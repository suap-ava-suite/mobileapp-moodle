const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { applyVersionedPatch, inspectVersionedPatch } = require('../scripts/apply-versioned-core-patch.cjs');

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ifrn-route-params-'));
    t.after(() => {
        assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
        assert(path.basename(root).startsWith('ifrn-route-params-'));
        fs.rmSync(root, { recursive: true });
    });
    const relative = 'src/MoodleIFRN/patches/course-route-params.manifest.json';
    const manifest = JSON.parse(fs.readFileSync(relative, 'utf8'));
    assert.equal(manifest.targets.length, 1);
    const target = manifest.targets[0].path;
    assert.equal(target, 'src/core/services/navigator.ts');
    fs.mkdirSync(path.dirname(path.join(root, target)), { recursive: true });
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(path.join(root, target), execFileSync('git', ['show', `${manifest.baseCommit}:${target}`]));
    fs.copyFileSync(relative, path.join(root, relative));
    fs.copyFileSync(manifest.patchPath, path.join(root, manifest.patchPath));
    return { root, target: path.join(root, target), manifest: path.join(root, relative) };
}

test('the real route-parameter patch applies once and preserves its validated postimage on repetition', t => {
    const s = fixture(t);
    assert.equal(inspectVersionedPatch(s.manifest, s.root).state, 'ready');
    assert.equal(applyVersionedPatch(s.manifest, s.root).applied, true);
    const after = fs.readFileSync(s.target, 'utf8');
    assert(after.includes('resolvedRouteParams = new WeakMap'));
    assert(!after.includes('route.queryParams[name] = storedParam'));
    assert.equal(applyVersionedPatch(s.manifest, s.root).state, 'already-applied');
    assert.equal(fs.readFileSync(s.target, 'utf8'), after);
});

test('an incompatible Moodle navigator stops the patch without writing anything', t => {
    const s = fixture(t);
    const source = fs.readFileSync(s.target, 'utf8') + '\n// synthetic upstream change\n';
    fs.writeFileSync(s.target, source);
    assert.throws(() => applyVersionedPatch(s.manifest, s.root), /incompatível/);
    assert.equal(fs.readFileSync(s.target, 'utf8'), source);
});
