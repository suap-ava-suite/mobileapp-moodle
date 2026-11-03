const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'services_mobile', 'painel-ava.config.ts'), 'utf8');
const configJavaScript = ts.transpileModule(configSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const configModule = { exports: {} };
vm.runInNewContext(configJavaScript, { module: configModule, exports: configModule.exports, URL });

test('Gov.br URL detection accepts official HTTPS hosts and rejects lookalike origins', () => {
    const { isGovBrAuthenticationUrl } = configModule.exports;

    assert.equal(isGovBrAuthenticationUrl('https://sso.acesso.gov.br/authorize'), true);
    assert.equal(isGovBrAuthenticationUrl('https://gov.br/'), true);
    assert.equal(isGovBrAuthenticationUrl('http://sso.acesso.gov.br/authorize'), false);
    assert.equal(isGovBrAuthenticationUrl('https://gov.br.example.com/'), false);
    assert.equal(isGovBrAuthenticationUrl('https://example.gov.br.attacker.test/'), false);
    assert.equal(isGovBrAuthenticationUrl('not a url'), false);
});

test('Gov.br ends the in-app attempt and offers an explicit external-browser choice', () => {
    const source = fs.readFileSync(path.join(root, 'services_mobile', 'painel-ava.service.ts'), 'utf8');
    const marketplace = fs.readFileSync(path.join(root, 'marketplace-ifrn', 'marketplace-ifrn.ts'), 'utf8');
    const template = fs.readFileSync(path.join(root, 'marketplace-ifrn', 'marketplace-ifrn.html'), 'utf8');

    assert.match(source, /hasEnteredSuapAuthentication && isGovBrAuthenticationUrl\(url\)/);
    assert.match(source, /hasEnteredSuapAuthentication = true;/);
    assert.match(source, /finishWithError\(GOVBR_MOBILE_UNAVAILABLE_MESSAGE\)/);
    assert.doesNotMatch(source, /authorization_id/);
    assert.match(source, /const loadStartSubscription = browser\.on\('loadstart'\)[\s\S]*?if \(hasEnteredSuapAuthentication && isGovBrAuthenticationUrl\(url\)\)[\s\S]*?return;/);
    assert.match(marketplace, /window\.open\('https:\/\/suap\.ifrn\.edu\.br\/accounts\/login\/', '_system'\)/);
    assert.match(marketplace, /error\.message === GOVBR_MOBILE_UNAVAILABLE_MESSAGE/);
    assert.match(template, /Continuar no navegador/);
    assert.match(template, /Voltar ao login SUAP no app/);
});

test('a successful profile API response bypasses the secondary HTML request', async () => {
    const source = fs.readFileSync(path.join(root, 'services_mobile', 'painel-ava.service.ts'), 'utf8');
    const start = source.indexOf('var currentProfile = profileFromDocument(document');
    const endMarker = '}).catch(function () {\n                                sendSuccess(currentProfile || null);\n                            });';
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, 'expected the production profile selection code');

    let result;
    let rootRequests = 0;
    const profile = { matricula: 'synthetic-user', identificacao: 'synthetic-user' };
    const context = {
        Promise,
        document: {},
        setTimeout: () => 0,
        profileFromDocument: () => ({ nome: 'Synthetic Name' }),
        sendSuccess: value => { result = value; },
        mergeProfiles: (primary, secondary) => ({ ...(secondary || {}), ...(primary || {}) }),
        fetchUserInfo: () => Promise.resolve(profile),
        fetch: () => { rootRequests++; return Promise.resolve({ ok: false }); },
        parseRootProfile: () => null,
    };
    vm.runInNewContext(`(function () { ${source.slice(start, end + endMarker.length)} })();`, context);
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(result.matricula, 'synthetic-user');
    assert.equal(rootRequests, 0);
});
