const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'services_mobile', 'govbr-browser.service.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadService(browserWindow) {
    const module = { exports: {} };
    vm.runInNewContext(compiled, {
        module,
        exports: module.exports,
        URL,
        window: browserWindow,
        require: () => ({ Injectable: () => value => value }),
    });

    return module.exports;
}

test('Gov.br authorization validation allows only HTTPS sso.acesso.gov.br without rewriting the URL', async () => {
    const { isGovBrAuthorizationUrl, GovBrBrowserService } = loadService({});
    const url = 'https://sso.acesso.gov.br/authorize?state=synthetic&authorization_id=synthetic%2Fvalue#fragment';

    assert.equal(isGovBrAuthorizationUrl(url), true);
    for (const invalid of [
        'http://sso.acesso.gov.br/authorize',
        'https://gov.br/authorize',
        'https://other.gov.br/authorize',
        'https://sso.acesso.gov.br.attacker.test/authorize',
        'https://user@sso.acesso.gov.br/authorize',
        'https://sso.acesso.gov.br:444/authorize',
        ` ${url}`,
        'not a URL',
    ]) {
        assert.equal(isGovBrAuthorizationUrl(invalid), false, invalid);
    }

    const service = new GovBrBrowserService();
    await assert.rejects(service.open('https://other.gov.br/authorize'), /inválido/);
});

test('Android bridge opens the exact URL, exposes native mode, and rejects concurrent windows', async () => {
    const url = 'https://sso.acesso.gov.br/authorize?state=synthetic&authorization_id=synthetic';
    let bridgeUrl;
    let resolveBridge;
    const browserWindow = {
        cordova: {},
        ifrnCustomTabs: {
            open(value, success) {
                bridgeUrl = value;
                resolveBridge = success;
            },
        },
    };
    const { GovBrBrowserService } = loadService(browserWindow);
    const service = new GovBrBrowserService();
    const opening = service.open(url);

    assert.equal(bridgeUrl, url);
    await assert.rejects(service.open(url), /janela/i);
    resolveBridge('custom-tab');
    assert.equal(await opening, 'custom-tab');
    await assert.rejects(service.open(url), /janela/i);

    service.onBrowserReturned();
    const nextAttempt = service.open(url);
    resolveBridge('external-browser');
    assert.equal(await nextAttempt, 'external-browser');
});

test('Cordova exec recupera a ponte nativa sem encaminhar a autenticação ao navegador externo', async () => {
    const url = 'https://sso.acesso.gov.br/authorize?state=synthetic';
    let nativeCall;
    let externalOpenCount = 0;
    const browserWindow = {
        cordova: {
            exec(success, error, service, action, args) {
                nativeCall = { success, error, service, action, args };
            },
        },
        open: () => externalOpenCount++,
    };
    const { GovBrBrowserService } = loadService(browserWindow);
    const service = new GovBrBrowserService();
    const opening = service.open(url);

    assert.equal(nativeCall.service, 'IfrnCustomTabs');
    assert.equal(nativeCall.action, 'open');
    assert.deepEqual(Array.from(nativeCall.args), [url]);
    nativeCall.success('custom-tab');
    assert.equal(await opening, 'custom-tab');
    assert.equal(externalOpenCount, 0);
});

test('Cordova com ponte indisponível falha sem abrir navegador externo', async () => {
    let externalOpenCount = 0;
    const { GovBrBrowserService } = loadService({ cordova: {}, open: () => externalOpenCount++ });
    const service = new GovBrBrowserService();

    await assert.rejects(service.open('https://sso.acesso.gov.br/authorize?state=synthetic'), /ponte do navegador seguro/i);
    assert.equal(externalOpenCount, 0);
});

test('iOS Safari view reports dismissal without treating it as authentication', async () => {
    const url = 'https://sso.acesso.gov.br/authorize?state=synthetic';
    let resolveOpened;
    let notifyReturned;
    const browserWindow = {
        cordova: {},
        ifrnCustomTabs: {
            open(value, success, _error, returned) {
                assert.equal(value, url);
                resolveOpened = success;
                notifyReturned = returned;
            },
        },
    };
    const { GovBrBrowserService } = loadService(browserWindow);
    const service = new GovBrBrowserService();
    let returned = false;
    const opening = service.open(url, () => { returned = true; });

    resolveOpened('safari-view-controller');
    assert.equal(await opening, 'safari-view-controller');
    assert.equal(returned, false);
    await assert.rejects(service.open(url), /janela/i);

    notifyReturned();
    assert.equal(returned, true);
    const nextOpening = service.open(url);
    resolveOpened('safari-view-controller');
    assert.equal(await nextOpening, 'safari-view-controller');
});

test('Cordova plugin declares Safari Services for iOS while retaining the shared Android bridge', () => {
    const pluginRoot = path.join(__dirname, '..', 'plugins', 'cordova-plugin-ifrn-customtabs');
    const pluginXml = fs.readFileSync(path.join(pluginRoot, 'plugin.xml'), 'utf8');
    const pluginPackage = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'package.json'), 'utf8'));
    const iosSource = fs.readFileSync(path.join(pluginRoot, 'src', 'ios', 'IfrnSafariBrowser.m'), 'utf8');
    const androidSource = fs.readFileSync(path.join(pluginRoot, 'src', 'android', 'IfrnCustomTabs.java'), 'utf8');

    assert.match(pluginXml, /<platform name="android">/);
    assert.match(pluginXml, /<platform name="ios">/);
    assert.match(pluginXml, /<framework src="SafariServices\.framework"\s*\/>/);
    assert.match(pluginXml, /ios-package" value="IfrnSafariBrowser"/);
    assert.deepEqual(pluginPackage.cordova.platforms, ['android', 'ios']);
    assert.match(iosSource, /SFSafariViewController/);
    assert.match(iosSource, /browser-returned/);
    assert.doesNotMatch(iosSource, /ASWebAuthenticationSession/);
    assert.match(androidSource, /result\.setKeepCallback\(true\)/);
    assert.match(androidSource, /public void onResume\(boolean multitasking\)/);
    assert.match(androidSource, /"browser-returned"/);
    assert.match(androidSource, /queryIntentServices\(serviceIntent, 0\)/);
    assert.doesNotMatch(androidSource, /Intent\.ACTION_VIEW/);
});

test('shared Cordova bridge separates browser-opened and browser-returned callbacks', () => {
    const bridgeSource = fs.readFileSync(path.join(__dirname, '..', 'plugins', 'cordova-plugin-ifrn-customtabs',
        'www', 'ifrn-custom-tabs.js'), 'utf8');
    let nativeCallback;
    const module = { exports: {} };
    vm.runInNewContext(bridgeSource, {
        module,
        exports: module.exports,
        require: () => callback => { nativeCallback = callback; },
    });

    const states = [];
    module.exports.open('https://sso.acesso.gov.br/authorize?state=synthetic',
        mode => states.push(mode), assert.fail, () => states.push('returned'));
    nativeCallback('safari-view-controller');
    nativeCallback('browser-returned');

    assert.deepEqual(states, ['safari-view-controller', 'returned']);
});

test('sem uma ponte nativa o app falha fechado sem abrir navegador externo', async () => {
    const url = 'https://sso.acesso.gov.br/authorize?state=synthetic';
    const opened = [];
    const { GovBrBrowserService } = loadService({ open: (...args) => opened.push(args) });
    const service = new GovBrBrowserService();

    await assert.rejects(service.open(url), /ponte do navegador seguro/i);
    assert.equal(opened.length, 0);
});

test('falha nativa libera nova tentativa sem trocar para navegador externo', async () => {
    const url = 'https://sso.acesso.gov.br/authorize?state=synthetic';
    let attempt = 0;
    const failureWindow = { cordova: { exec: (success, error) => {
        attempt++;
        if (attempt === 1) {
            error('synthetic launch failure');
        } else {
            success('custom-tab');
        }
    } } };
    const { GovBrBrowserService: ServiceWithFailure } = loadService(failureWindow);
    const failedService = new ServiceWithFailure();
    await assert.rejects(failedService.open(url), /navegador seguro/i);
    assert.equal(await failedService.open(url), 'custom-tab');
    assert.equal(attempt, 2);
});
