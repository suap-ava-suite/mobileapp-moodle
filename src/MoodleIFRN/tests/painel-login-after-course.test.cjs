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
    let capturedGovUrl = '';
    const resumedUrls = [];
    const listeners = new Map();
    const browser = {
        on: name => ({ subscribe: callback => {
            listeners.set(name, callback);
            return { unsubscribe: () => listeners.delete(name) };
        } }),
        _loadAfterBeforeload: url => resumedUrls.push(url),
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
        './painel-ava.config': {
            GOVBR_MOBILE_UNAVAILABLE_MESSAGE: 'Gov.br usa navegador seguro.',
            isGovBrAuthenticationUrl: url => new URL(url).hostname === 'sso.acesso.gov.br',
            PAINEL_AVA_CONFIG: {
            baseUrl: 'https://ava.ifrn.edu.br', diariosPath: '/api/v1/diarios/',
            },
        },
        './suap-login-telemetry': {
            consumeFreshPanelProfile: () => false,
            reportSuapDuration: () => {},
        },
        './govbr-redirect-handoff': { GovBrRedirectHandoff: class {
            clear() {}
            capture(url) { capturedGovUrl = url; return true; }
            consume() { return null; }
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
        }, console: { log() {} }, URL, performance: { now: () => 1 },
    });
    const service = new mod.exports.PainelAvaService();
    for (const reuseSession of [false, true]) {
        nativeBeforeload = 'get';
        const subscription = service.authenticateWithBrowser({ reuseSession, readOnly: true }).subscribe();
        assert.equal(nativeBeforeload, 'get', 'intercepta o redirecionamento Gov.br antes do carregamento');
        assert.equal(opened.url, 'https://ava.ifrn.edu.br/');
        assert.equal(opened.options.hidden, 'yes');
        assert.equal(opened.options.clearcache, reuseSession ? 'no' : 'yes');
        assert.equal(opened.options.clearsessioncache, reuseSession ? 'no' : 'yes');
        const normalRedirect = 'https://suap.ifrn.edu.br/o/authorize/';
        listeners.get('beforeload')({ url: normalRedirect });
        assert.equal(resumedUrls.at(-1), normalRedirect, 'redirecionamentos normais continuam no InAppBrowser');
        subscription.unsubscribe();
        assert.equal(listeners.size, 0);
    }

    let govError = '';
    const govSubscription = service.authenticateWithBrowser({ readOnly: true }).subscribe({
        error: error => { govError = error.message; },
    });
    const suapLoginUrl = 'https://suap.ifrn.edu.br/accounts/login/';
    listeners.get('beforeload')({ url: suapLoginUrl });
    const govUrl = 'https://sso.acesso.gov.br/authorize?state=synthetic';
    listeners.get('beforeload')({ url: govUrl });
    assert.equal(capturedGovUrl, govUrl);
    assert.equal(govError, 'Gov.br usa navegador seguro.');
    assert.equal(resumedUrls.includes(govUrl), false, 'Gov.br não pode ser carregado na WebView');
    assert.equal(listeners.size, 0);
    govSubscription.unsubscribe();
    assert.equal(closed, 3);
});
