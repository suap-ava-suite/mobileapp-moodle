const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { assertCordovaRuntime, assertStandardSessionCore } = require('../scripts/cordova-runtime-check.cjs');

test('native build refuses missing/empty Cordova bridge and accepts a complete platform bridge', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ifrn-runtime-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true })); // Only this test-owned temp directory.
    assert.throws(() => assertCordovaRuntime(root, 'android'), /ausente ou incompleto/);
    const file = path.join(root, 'platforms/android/platform_www/cordova.js');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '');
    assert.throws(() => assertCordovaRuntime(root, 'android'), /ausente ou incompleto/);
    fs.writeFileSync(file, '/* Synthetic runtime contract, not a deployable Cordova bridge. */\n' +
        '// cordova/platform cordova/channel\n' + ' '.repeat(4096));
    assert.throws(() => assertCordovaRuntime(root, 'android'), /plugin Moodle/);
    const plugin = path.join(root, 'platforms/android/platform_www/plugins/cordova-plugin-moodleapp/www/index.js');
    fs.mkdirSync(path.dirname(plugin), { recursive: true });
    fs.writeFileSync(plugin, 'module.exports = {};');
    assert.throws(() => assertCordovaRuntime(root, 'android'), /wrapper/);
    fs.writeFileSync(plugin, 'cordova.define("cordova-plugin-moodleapp.moodleapp", function(require, exports, module) { module.exports = {}; });');
    assert.equal(assertCordovaRuntime(root, 'android'), file);
    assert.throws(() => assertCordovaRuntime(root, '../outside'), /inválida/);
});

test('retired session patch is rejected without overwriting local code', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ifrn-session-baseline-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const file = path.join(root, 'sites.ts');
    const source = 'synthetic official baseline';
    fs.writeFileSync(file, source);
    const targets = [{ path: 'sites.ts', baseSha256: require('node:crypto').createHash('sha256').update(source).digest('hex') }];
    assert.equal(assertStandardSessionCore(root, targets), 1);
    fs.writeFileSync(file, 'synthetic experimental mutation');
    assert.throws(() => assertStandardSessionCore(root, targets), /worktree isolado/);
    assert.equal(fs.readFileSync(file, 'utf8'), 'synthetic experimental mutation');
    assert.throws(() => assertStandardSessionCore(root, [{ ...targets[0], path: '../outside.ts' }]), /baseline de sessão/);
});
