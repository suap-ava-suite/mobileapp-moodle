const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { assertCordovaRuntime } = require('../scripts/cordova-runtime-check.cjs');

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
    assert.equal(assertCordovaRuntime(root, 'android'), file);
    assert.throws(() => assertCordovaRuntime(root, '../outside'), /inválida/);
});
