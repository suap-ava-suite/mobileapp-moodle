'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {sha256, inspect, apply} = require('./fixtures/p09/patch-runner.cjs');

function removeTempFixture(root) {
    const realRoot = fs.realpathSync(root);
    assert.equal(path.dirname(realRoot), fs.realpathSync(os.tmpdir()));
    assert(path.basename(realRoot).startsWith('ifrn-p09-patch-'));
    fs.rmSync(realRoot, {recursive: true, force: true});
}

function fixture(t, initial = 'anchor-old\n') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ifrn-p09-patch-'));
    fs.mkdirSync(path.join(root, 'src'), {recursive: true});
    const file = path.join(root, 'src', 'fixture.txt');
    fs.writeFileSync(file, initial);
    const after = initial.replace('anchor-old', 'anchor-new');
    const manifest = {schema: 'ifrn-patch/v1', id: 'ifrn-session-prototype.v1', targets: [], operations: [{
        path: 'src/fixture.txt', sha256: sha256(initial), before: 'anchor-old', after: 'anchor-new', postSha256: sha256(after),
    }]};
    const manifestPath = path.join(root, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    t.after(() => removeTempFixture(root));
    return {root, file, manifest};
}

test('p09 patch manifest: inspect then apply is idempotent and reports a reviewable file delta', t => {
    const {root, file, manifest} = fixture(t);
    assert.equal(inspect(manifest, root)[0].state, 'ready');
    assert.deepEqual(apply(manifest, root).applied.map(value => value.replaceAll('\\', '/')), ['src/fixture.txt']);
    assert.equal(fs.readFileSync(file, 'utf8'), 'anchor-new\n');
    assert.equal(inspect(manifest, root)[0].state, 'already-applied');
    assert.deepEqual(apply(manifest, root).applied, []);
    assert.equal(fs.readFileSync(file, 'utf8'), 'anchor-new\n');
});

test('p09 patch manifest: incompatible hash fails closed before writing', t => {
    const {root, file, manifest} = fixture(t, 'unexpected\n');
    const before = fs.readFileSync(file, 'utf8');
    assert.throws(() => apply(manifest, root), /incompatible or ambiguous/);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('p09 patch manifest: path traversal and ambiguous anchors are rejected', t => {
    const {root, manifest} = fixture(t);
    const traversal = structuredClone(manifest);
    traversal.operations[0].path = '../outside.txt';
    assert.throws(() => inspect(traversal, root), /relative and contained/);

    const ambiguous = structuredClone(manifest);
    const duplicate = 'anchor-old\nanchor-old\n';
    fs.writeFileSync(path.join(root, 'src', 'fixture.txt'), duplicate);
    ambiguous.operations[0].sha256 = sha256(duplicate);
    ambiguous.operations[0].postSha256 = sha256(duplicate.replace('anchor-old', 'anchor-new'));
    assert.throws(() => inspect(ambiguous, root), /incompatible or ambiguous/);
});

test('p09 patch manifest: blocked integration manifest cannot write even with --apply', t => {
    const {root, file, manifest} = fixture(t);
    manifest.status = 'blocked';
    manifest.blockReason = 'native ACK barrier is not available';
    const before = fs.readFileSync(file, 'utf8');
    assert.throws(() => apply(manifest, root), /inspection-only/);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
});
