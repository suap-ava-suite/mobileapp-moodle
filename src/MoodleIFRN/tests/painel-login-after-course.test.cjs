const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const rxjs = require('rxjs');

test('login principal retoma redirects após curso e preserva a política de cookies', () => {
    let nativeBeforeload = 'get'; // Estado deixado pela janela anterior de curso no Android.
    let opened;
    let closed = 0;
    const listeners = new Map();
    const browser = {
        on: name => ({ subscribe: callback => {
            listeners.set(name, callback);
            return { unsubscribe: () => listeners.delete(name) };
        } }),
        hide() {}, show() {}, executeScript: async () => [],
    };
    const mocks = {
        '@angular/common/http': {},
        '@angular/core': { Injectable: () => value => value },
        '@static/opener': { CoreOpener: {
            openInApp: (url, options) => {
                if (options.beforeload !== undefined) nativeBeforeload = options.beforeload;
                opened = { url, options };
                return browser;
            },
            closeInAppBrowser: () => closed++,
        } },
        rxjs,
        './painel-ava.config': { PAINEL_AVA_CONFIG: {
            baseUrl: 'https://ava.ifrn.edu.br', diariosPath: '/api/v1/diarios/',
        } },
        './painel-courses': {},
        '../mobilemoodle/core_mobile/oauth-profile': {},
        '../mobilemoodle/core_mobile/profile-refresh': {},
    };
    const source = fs.readFileSync('src/MoodleIFRN/services_mobile/painel-ava.service.ts', 'utf8');
    const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const mod = { exports: {} };
    vm.runInNewContext(output, {
        exports: mod.exports, require: name => {
            assert.ok(name in mocks, name);
            return mocks[name];
        }, console: { log() {} }, URL,
    });
    const service = new mod.exports.PainelAvaService();
    for (const reuseSession of [false, true]) {
        nativeBeforeload = 'get';
        const subscription = service.authenticateWithBrowser({ reuseSession, readOnly: true }).subscribe();
        assert.equal(nativeBeforeload, 'no', 'não pode aguardar beforeload de outro fluxo');
        assert.equal(opened.url, 'https://ava.ifrn.edu.br/');
        assert.equal(opened.options.hidden, 'yes');
        assert.equal(opened.options.clearcache, reuseSession ? 'no' : 'yes');
        assert.equal(opened.options.clearsessioncache, reuseSession ? 'no' : 'yes');
        subscription.unsubscribe();
        assert.equal(listeners.size, 0);
    }
    assert.equal(closed, 2);
});
