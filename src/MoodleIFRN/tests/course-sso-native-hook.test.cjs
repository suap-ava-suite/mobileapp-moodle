const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const { patchSource } = require('../../../scripts/cordova-hooks/ifrn-course-sso.js');

test('ajuste nativo mantém o UA do login principal e só permite opt-out explícito por janela', () => {
    const source = 'if (appendUserAgent != null) {\n settings.setUserAgentString(settings.getUserAgentString() + " " + appendUserAgent);\n}';
    const patched = patchSource(source);
    assert.match(patched, /appendUserAgent != null && !"yes"\.equals\(features.get\("omitappuseragent"\)\)/);
    assert.match(patched, /settings.setUserAgentString/);
    assert.equal(patchSource(patched), patched);
    assert.throws(() => patchSource('versão incompatível'), /incompatível/);
    assert.match(fs.readFileSync('config.xml','utf8'), /hook src="scripts\/cordova-hooks\/ifrn-course-sso.js" type="after_prepare"/);
});
