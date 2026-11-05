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

test('fallback uses the system browser and permits retry after return or launch failure', async () => {
    const url = 'https://sso.acesso.gov.br/authorize?state=synthetic';
    const opened = [];
    const { GovBrBrowserService } = loadService({ open: (...args) => opened.push(args) });
    const service = new GovBrBrowserService();

    assert.equal(await service.open(url), 'external-browser');
    assert.equal(opened[0][0], url);
    assert.equal(opened[0][1], '_system');
    service.onBrowserReturned();

    let attempt = 0;
    const failureWindow = { open: () => {
        attempt++;
        if (attempt === 1) throw new Error('synthetic launch failure');
    } };
    const { GovBrBrowserService: ServiceWithFailure } = loadService(failureWindow);
    const failedService = new ServiceWithFailure();
    await assert.rejects(failedService.open(url), /synthetic launch failure/);
    assert.equal(await failedService.open(url), 'external-browser');
});
